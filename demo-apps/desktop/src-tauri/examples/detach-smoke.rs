//! Does this build, with these capabilities, actually open a second window?
//!
//! Phase 5 shipped with that question open: the JS port is tested against a
//! fake, the child window's page is checked in a browser, and the one thing
//! neither covers is whether the Tauri runtime and `capabilities/default.json`
//! permit a second webview at all. A click would answer it, and a headless
//! compositor has no seat to click with — `wayland-info` lists no `wl_seat`.
//!
//! So this asks the same question from Rust, with the label, URL and title the
//! port passes. It is an example, not product code: it ships nowhere and is run
//! by hand.
//!
//!   cargo run --example detach-smoke
//!
//! Expect `created=true`, `windows=2`, `after_close=1`.

use std::thread;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// The same shape createTauriWindowPort builds: `doc-` label, a document key in
/// the query, and a title carrying the record id and no name.
const LABEL: &str = "doc-w1";
const URL: &str = "index.html?document=acme%3ACUSTOMER-MASTER%3Aview~CUS-02401";
const TITLE: &str = "CUSTOMER-MASTER view~CUS-02401";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            thread::spawn(move || {
                /* The main window has to finish loading first, or the second is
                   created against a runtime still starting up. */
                thread::sleep(Duration::from_secs(8));
                println!("SMOKE before={}", handle.webview_windows().len());

                match WebviewWindowBuilder::new(&handle, LABEL, WebviewUrl::App(URL.into()))
                    .title(TITLE)
                    .inner_size(1100.0, 800.0)
                    .build()
                {
                    Ok(child) => {
                        println!("SMOKE created=true label={}", child.label());
                        /* Long enough to sample the process table from outside:
                           a window object is not a loaded page, and each webview
                           gets its own WebKitWebProcess. */
                        thread::sleep(Duration::from_secs(18));
                        println!("SMOKE windows={}", handle.webview_windows().len());
                        println!("SMOKE title={:?}", child.title().unwrap_or_default());
                        println!("SMOKE url={}", child.url().map(|u| u.to_string()).unwrap_or_default());
                        let _ = child.close();
                        thread::sleep(Duration::from_secs(3));
                        println!("SMOKE after_close={}", handle.webview_windows().len());
                    }
                    Err(error) => println!("SMOKE created=false error={error}"),
                }
                handle.exit(0);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the detach smoke example");
}
