export const IpcChannels = {
  // electron store IpcChannels
  StoreGet: 'store:get',
  StoreSet: 'store:set',
  // invoke: renderer -> main (request/response)
  TimerGetSnapshot: 'timer:getSnapshot',
  TimerStartFocus: 'timer:startFocus', // { task: TaskRef }
  TimerPause: 'timer:pause',
  TimerResume: 'timer:resume',
  TimerCancel: 'timer:cancel',
  TimerEndEarly: 'timer:endEarly',
  TimerResolveComplete: 'timer:resolveComplete', // { markComplete: boolean }
  StatsGet: 'stats:get',
  ConfigGet: 'config:get',
  ConfigSet: 'config:set', // Partial<PomodoroConfig>
  NotionValidate: 'notion:validate', // { secret, tasksDbId } → { ok, error? }
  NotionSetup: 'notion:setup', // { secret, tasksDbId, sessionsDbId }
  // events: main -> renderer (push)
  TimerSnapshot: 'timer:snapshot', // TimerSnapshot
  StatsUpdated: 'stats:updated', // DayStats
  PromptMarkComplete: 'prompt:markComplete', // { task: string }
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
