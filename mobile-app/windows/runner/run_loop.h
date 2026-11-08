#ifndef RUNNER_RUN_LOOP_H_
#define RUNNER_RUN_LOOP_H_

#include <windows.h>

#include <chrono>
#include <functional>
#include <queue>

// A simple message loop that implements Flutter's run loop interface.
class RunLoop {
 public:
  RunLoop();
  ~RunLoop();

  // Prevent copying.
  RunLoop(const RunLoop&) = delete;
  RunLoop& operator=(const RunLoop&) = delete;

  // Runs the message loop until complete.
  void Run();

 private:
  using TimePoint = std::chrono::steady_clock::time_point;

  struct Task {
    TimePoint target_time;
    std::function<void()> task;

    bool operator>(const Task& other) const {
      return target_time > other.target_time;
    }
  };

  std::priority_queue<Task, std::vector<Task>, std::greater<Task>> task_queue_;
};

#endif  // RUNNER_RUN_LOOP_H_

