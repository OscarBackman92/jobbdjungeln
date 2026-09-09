'use client';

import { AlertTriangle, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  Switch,
} from '@/components/ui';
import { authClient } from '@/lib/auth-client';
import { updateProfileAction } from '@/server/actions/profile';

/**
 * Account settings, e-mail preferences and the two things GDPR entitles a user
 * to do without asking anyone: take their data out, and delete the account.
 */
export function AccountSettings({
  email,
  operatorId,
  name,
  weeklySummaryOptIn,
  reminderOptIn,
}: {
  email: string;
  operatorId: string;
  name: string;
  weeklySummaryOptIn: boolean;
  reminderOptIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [weekly, setWeekly] = useState(weeklySummaryOptIn);
  const [reminders, setReminders] = useState(reminderOptIn);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const reminderId = useId();
  const weeklyId = useId();

  function persist(next: {
    weeklySummaryOptIn?: boolean;
    reminderOptIn?: boolean;
    name?: string;
  }) {
    startTransition(async () => {
      const result = await updateProfileAction({
        name,
        weeklySummaryOptIn: weekly,
        reminderOptIn: reminders,
        ...next,
      });
      if (result.ok) toast.success('Sparat');
      else toast.error(result.error);
    });
  }

  function deleteAccount() {
    startTransition(async () => {
      const { error } = await authClient.deleteUser();
      if (error) {
        toast.error(error.message ?? 'Kunde inte radera kontot.');
        return;
      }
      router.push('/');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted">
            E-post: <span className="text-ink">{email}</span>
          </p>
          <p className="text-muted">
            Konto-id: <span className="font-mono text-ink">{operatorId}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E-post från oss</CardTitle>
          <CardDescription>Vi skickar aldrig något annat än det du väljer här.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <span>
              <Label htmlFor={reminderId}>Påminnelser</Label>
              <span className="mt-0.5 block text-[13px] text-muted">
                Ett mejl på morgonen när något behöver följas upp eller sökas.
              </span>
            </span>
            <Switch
              id={reminderId}
              checked={reminders}
              disabled={pending}
              onCheckedChange={(value) => {
                setReminders(value);
                persist({ reminderOptIn: value });
              }}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <span>
              <Label htmlFor={weeklyId}>Veckobrev</Label>
              <span className="mt-0.5 block text-[13px] text-muted">
                Måndagsöversikt över veckan som gått, plus nya träffar på dina sparade
                sökningar.
              </span>
            </span>
            <Switch
              id={weeklyId}
              checked={weekly}
              disabled={pending}
              onCheckedChange={(value) => {
                setWeekly(value);
                persist({ weeklySummaryOptIn: value });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Din data</CardTitle>
          <CardDescription>
            Allt du lagt in är ditt. Exporten är vanlig CSV som öppnas i Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/api/export?typ=ansokningar">
              <Download aria-hidden />
              Ansökningar (CSV)
            </a>
          </Button>
          <Button asChild>
            <a href="/api/export?typ=kalender">
              <Download aria-hidden />
              Kalender (ICS)
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger-text">Radera kontot</CardTitle>
          <CardDescription>
            Kontot och allt det innehåller tas bort direkt och går inte att få tillbaka.
            Exportera först om du vill spara något.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <AlertTriangle aria-hidden />
            Radera kontot
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:w-[min(28rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Radera kontot permanent?</DialogTitle>
            <DialogDescription>
              Alla ansökningar, sparade jobb, ditt CV och dina rapporter försvinner. Det går
              inte att ångra.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Skriv RADERA för att bekräfta" required>
              {(props) => (
                <Input
                  {...props}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                />
              )}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={confirmation !== 'RADERA'}
              onClick={deleteAccount}
            >
              Radera för alltid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
