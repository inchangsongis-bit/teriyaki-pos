import StaffAlerts from "@/components/StaffAlerts";

export default function FrontCounterPage() {
  return (
    <div className="flex-1 bg-zinc-50 p-6 dark:bg-black">
      <h1 className="mb-2 text-2xl font-semibold">Front Counter</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Customer help requests from the kiosk show up here and on the kitchen display.
      </p>
      <StaffAlerts emptyMessage="No active requests." />
    </div>
  );
}
