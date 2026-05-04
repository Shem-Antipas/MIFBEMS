import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTheme, type Theme } from "@/hooks/useTheme";

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon }
];

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">System Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className="justify-start"
                  aria-pressed={isSelected}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="push-advisories">Enable farmer advisories push</Label>
          <Checkbox id="push-advisories" defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="require-admin-2fa">Require 2FA for admin users</Label>
          <Checkbox id="require-admin-2fa" defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="lock-write-endpoints">Lock write endpoints after office hours</Label>
          <Checkbox id="lock-write-endpoints" />
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
