# **JS-Log-Manager (Standard Version)**
**JS-Log-Manager** is a high-performance, hardware-aware logging engine for Node.js. Built for speed and reliability, it achieves 1.3M+ Logs Per Second (LPS) by utilizing smart buffering, asynchronous I/O, and hardware-specific auto-tuning.

### **Key Features**
* **1.3M+ LPS Throughput:** Engineered for high-frequency data environments.

* **Hardware-Aware Auto-Tuning:** Detects your CPU (i7, M-Series, etc.) and optimizes write-buffers (64kb to 256kb) automatically.

* **Zero-Loss Midnight Rotation:** A "Gatekeeper" system ensures logs are queued and preserved during midnight file handovers.

* **Smart "Janitor" Cleanup:** Background log retention service with configurable batching to protect system resources.

* **Granular Retention:** Define specific expiration rules for different log types (e.g., error logs kept longer than debug).

* **One Dependency:** Lightweight architecture with only node-cron used for the background cleaner scheduling.

## 📦 Installation
```javascript
npm install js-log-manager
```

## 🛠️ Quick Start
```javascript
import jsLog from 'js-log-manager';

// Auto-tune buffers based on your hardware
jsLog.bufferAutoTune();

// Initialize a log category
const logger = new jsLog.Logs({
    filename: 'api-server',
    level: 'info',
    txtColor: 'cyan'
});

// Start logging
logger.file("User 'JohnSpriggs' authenticated successfully.");
logger.terminal("System heartbeat stable.");
```
#
## 🔓 Freedom of Logging (The Manager Approach)
JS-Log-Manager removes the strict constraints of traditional loggers. Most libraries force you into one file; we give you the freedom to create as many specialized log instances as your application requires.
```JavaScript
import jsLog from 'js-log-manager';

// Define logs by their purpose, not just their level
const user_api_errors = new jsLog.Logs({ filename: 'user-api', txtColor: 'red' });
const payment_logs = new jsLog.Logs({ filename: 'payments', txtColor: 'green' });
const auth_audit = new jsLog.Logs({ filename: 'security', toTerminal: false }); // Quietly log to file only
```
#
### 🛰️ **The Four Logging Functions**
The engine provides four distinct ways to output your data. Each instance can be configured to toggle these on or off via the `toFile`, `toTerminal`, and `terminalRaw` settings.

| Function | Output | Synchronized? | Best Use Case |
| :--- | :--- | :--- | :--- |
| **`logg(data)`** | **File + Terminal** | ✅ Yes | Your go-to function for standard app logging. |
| **`file(data)`** | **Disk Only** | N/A | High-volume background data (e.g., raw API payloads). |
| **`terminal(data)`** | **Console Only** | N/A | Real-time debugging and system heartbeats. |
| **`terminal_raw(data)`** | **Raw Console** | N/A | Minimalist output without timestamps or branding. |
### 🔄 Unified Sync with `logg()`
The `logg()` function solves the "Timestamp Drift" problem. In high-traffic environments, calling `.file()` and `.terminal()` separately can result in slight millisecond differences. ***`logg()` captures the time once and distributes it to all enabled outputs, ensuring your records match perfectly.***
```JavaScript
const logger = new jsLog.Logs({ 
    filename: 'app-engine',
    toFile: true,       // Default
    toTerminal: true,   // Default
    terminalRaw: false  // Default
});

// Sends to both file and terminal with the exact same timestamp
logger.logg("Process Initialized"); 
```
#
## 🛠️ Performance Tuning
### Buffer Auto-Tune
Stop guessing your buffer sizes. Call `bufferAutoTune()` to let the engine inspect your CPU and set the optimal write-buffer (64kb, 128kb, or 256kb) for your specific hardware.

```JavaScript
// Optimized for your specific CPU (i7, M3, Threadripper, etc.)
jsLog.bufferAutoTune(); 
```

### Automatic File Indexing
Out-of-the-box support for high-traffic file splitting. If a log file hits your `maxSize` limit, the engine automatically indexes it `(e.g., api_2024-01-01_001.log)` so no data is ever overwritten or lost.

## 🧹 The Janitor: 3 Ways to Handle Cleanup
The `jsLog.start()` function manages your log retention using only one dependency: `node-cron`.

### 1. The Global "Catch-All"
Just starting the function uses the 30 day default
```JavaScript
jsLog.start()
 ```

Keep all logs for a set amount of days.
```JavaScript
jsLog.start(7); // Deletes everything older than 7 days
```
#
### 2. The Granular Override
Set specific rules for specific files with a fallback for the rest.

```JavaScript
jsLog.start({
    default: 7,   
    payments: 90, // Keep financial logs for 3 months
    debug: 1      // Purge debug logs daily
});
```
#
### 3. The "Named-Only" Mode (Strict)
If you don't provide a default key, the janitor will only touch the files you explicitly name, leaving all other logs safe on the disk forever.

```JavaScript
jsLog.start({
    temp_logs: 1,
    test_results: 2
});
```
#
### ⚙️ Advanced Configuration
Our configuration is strict to ensure production stability.

```javascript
jsLog.configuration({
    setDir: 'logs',                // Custom directory
    setBufferSize: 512,            // Manual buffer override (kb)
    setDeletionBatchSize: 20,      // Number of files deleted per batch
    cleanupTime: '00 05 * * *'     // Run Janitor at 5:00 AM (Cron format)
});
```
#
### 📊 Performance Benchmarks
Tested on *Intel i7-11800H @ 2.30GHz*
>
Metric | Result
|:---|---:|
Peak Throughput	| 1,320,000+ LPS
Write Buffer | Dynamic (64kb - 256kb)
Rotation Delay | < 1ms
>
#
Tested with 100,000 logs on *low-power mode (15% battery)*.

JS-Log-Manager is engineered for efficiency. In head-to-head architectural tests, it maintains a lean memory footprint and high throughput even under system throttling.
Logger | Mode | Time (s) | Throughput (LPS) | Memory
:--- | :--- | :--- | :--- | :---
JS-Log-Manager | Terminl | 0.106 | 937,434 | ~19 MB
Pino | Terminal | 0.131 | 762,354 | ~31 MB
Winston | Terminal | 0.183 | 545,978 | ~20 MB
JS-Log-Manager | File | 0.141 | 704,922 | ~38 MB
Pino | File | 0.084 | 1,181,289 | ~32 MB 
Winston | File | 1.120 | 89,244 | ~140 MB
#
### 🏗️ Architecture: The Gatekeeper Pattern
To maintain a 1.3M+ LPS target, the engine uses a Gatekeeper Flag (isDateUpdating). When a date rotation occurs:

1) The gate closes, pausing direct file writes.

2) Incoming logs are captured in a high-speed memory queue.

3) The new log file is initialized.

4) The gate opens and flushes the queue, ensuring no data loss and perfect chronological order.

#
### 👨‍💻 Author
### [John Spriggs](https://www.linkedin.com/in/john-s-836703a/)
#

### 📝 License
This project is licensed under the ISC License.
#

### Coming Soon: JS-Log-Manager-Pro (2M+ LPS)
The Pro version moves the heavy lifting to Worker Threads and utilizes SharedArrayBuffers for zero-latency data handoffs.