use tauri::{Emitter, Manager};

fn sentinel_marker(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
  app.path().app_data_dir().ok().map(|dir| dir.join("sentinel-panic.pending"))
}

#[tauri::command]
fn sentinel_pending_failure(app: tauri::AppHandle) -> bool {
  sentinel_marker(&app).is_some_and(|path| path.exists())
}

#[tauri::command]
fn sentinel_acknowledge_failure(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(path) = sentinel_marker(&app) {
    match std::fs::remove_file(path) {
      Ok(()) => (),
      Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
      Err(_) => return Err("Could not clear diagnostic marker".into()),
    }
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![sentinel_pending_failure, sentinel_acknowledge_failure])
    .setup(|app| {
      let handle = app.handle().clone();
      let marker = sentinel_marker(&handle);
      if let Some(path) = &marker {
        if let Some(parent) = path.parent() { let _ = std::fs::create_dir_all(parent); }
      }
      let previous = std::panic::take_hook();
      std::panic::set_hook(Box::new(move |info| {
        // Only a fixed marker is persisted. Panic text, paths and memory are never uploaded.
        if let Some(path) = &marker { let _ = std::fs::write(path, b"native-panic"); }
        let _ = handle.emit("sentinel-native-error", ());
        previous(info);
      }));
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|_app, event| {
      // The test must crash an initialized app, not race GTK/WebKit startup.
      // This one-use fault trigger is absent from release builds.
      #[cfg(debug_assertions)]
      if matches!(event, tauri::RunEvent::Ready) {
        if let Some(trigger) = std::env::var_os("NEXORA_SENTINEL_TEST_PANIC_ONCE") {
          if std::fs::remove_file(trigger).is_ok() {
            std::thread::spawn(|| {
              let _ = std::panic::catch_unwind(|| panic!("Sentinel isolated recovery test"));
              // An abrupt crash must not race GTK/WebKit process-exit handlers.
              // The real panic hook above runs before the intentional abort.
              std::process::abort();
            });
          }
        }
      }
      #[cfg(not(debug_assertions))]
      let _ = event;
    });
}
