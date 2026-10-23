"""Run one verification command, retaining its result and cleaning up its children.

Usage (from the repository root): python3 path/to/run-check.py NAME COMMAND ...
Linux subreaping also catches orphaned/detached browser and build workers. Only
descendants of this runner are observed or terminated; other worktrees are left alone.
"""
import ctypes
import datetime
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

directory = Path(__file__).resolve().parent
name, *command = sys.argv[1:]
if not command:
    raise SystemExit("A command is required")
libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
    raise OSError(ctypes.get_errno(), "Cannot enable child subreaping")


def children():
    processes = {}
    for path in Path('/proc').glob('[0-9]*/stat'):
        try:
            fields = path.read_text().rsplit(')', 1)[1].split()
            processes[int(path.parent.name)] = (int(fields[1]), fields[0])
        except (OSError, ValueError, IndexError):
            continue
    descendants = {os.getpid()}
    while True:
        found = {pid for pid, (parent, _) in processes.items() if parent in descendants}
        if found <= descendants:
            break
        descendants |= found
    return {pid: processes[pid][1] for pid in descendants if pid != os.getpid()}


def interrupt(signum, frame):
    raise InterruptedError(f"Verification interrupted by signal {signum}")


signal.signal(signal.SIGTERM, interrupt)
signal.signal(signal.SIGINT, interrupt)
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
result = 1
cleanup = []
failure = None
try:
    with (directory / f'{name}.log').open('w') as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        print(f"Started {name}: PID {process.pid}; log {directory / (name + '.log')}", flush=True)
        result = process.wait()
except BaseException as error:
    failure = str(error)
    raise
finally:
    # Kill every remaining descendant, including children reparented to us.
    # Successful test/browser hooks normally leave nothing to terminate.
    for attempt in range(40):
        remaining = children()
        if not remaining:
            break
        for pid, state in remaining.items():
            if state != 'Z':
                try:
                    os.kill(pid, signal.SIGTERM if attempt < 20 else signal.SIGKILL)
                    if pid not in cleanup:
                        cleanup.append(pid)
                except ProcessLookupError:
                    pass
        while True:
            try:
                if os.waitpid(-1, os.WNOHANG)[0] == 0:
                    break
            except ChildProcessError:
                break
        time.sleep(0.1)
    remaining = children()
    receipt = {
        'command': command, 'cwd': os.getcwd(), 'startedAt': started,
        'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'exitCode': result, 'failure': failure, 'terminatedDescendants': cleanup,
        'remainingDescendants': remaining,
        'environment': {key: os.environ[key] for key in ['LD_LIBRARY_PATH', 'NODE_OPTIONS'] if key in os.environ},
    }
    (directory / f'{name}-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt), flush=True)
    if remaining:
        raise RuntimeError(f"Verification descendants still present: {remaining}")
sys.exit(result)
