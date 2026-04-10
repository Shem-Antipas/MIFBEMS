const SettingsPage = () => {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">System Settings</h1>
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <label className="flex items-center justify-between text-sm">
          Enable farmer advisories push
          <input type="checkbox" defaultChecked className="h-4 w-4" />
        </label>
        <label className="flex items-center justify-between text-sm">
          Require 2FA for admin users
          <input type="checkbox" defaultChecked className="h-4 w-4" />
        </label>
        <label className="flex items-center justify-between text-sm">
          Lock write endpoints after office hours
          <input type="checkbox" className="h-4 w-4" />
        </label>
      </div>
    </section>
  );
};

export default SettingsPage;
