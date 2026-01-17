# Reliability PR

This branch tracks work for improving reliability and data safety.

Scope:
- Backpressure handling for terminal streams
- Stream lifecycle correctness
- Flush promise resolution
- Write gating to prevent write-after-end
- Cleaner cron singleton enforcement

Out of scope:
- Performance optimizations
- Input validation changes
