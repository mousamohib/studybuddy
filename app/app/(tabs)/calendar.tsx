import { Empty, Screen, T } from '@/components/ui';

export default function Calendar() {
  return (
    <Screen>
      <T variant="title">Calendar</T>
      <Empty title="Coming in build step 3"
        body="Month and week views of your study sessions and deadlines, synced with your phone's calendar, plus reminders." />
    </Screen>
  );
}
