import { DatabaseBackup, Flag, HeartPulse, Palette, SlidersHorizontal, Tags } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { DataError, PageSkeleton } from "@/components/feedback/states";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BackupControls } from "@/components/settings/backup-controls";
import { CategoryManager } from "@/components/settings/category-manager";
import { GeneralSettingsForm, MilestonesForm, SurgeryDateForm } from "@/components/settings/settings-forms";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { load } from "@/lib/data/load";
import { todayIso } from "@/lib/dates/calendar";
import { countTreatmentData } from "@/lib/db/repositories/backup";
import { listCategories } from "@/lib/db/repositories/categories";
import { getSettings, listMilestones } from "@/lib/db/repositories/settings";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const result = await load("settings", async () => {
    const [settings, milestones, categories, counts] = await Promise.all([
      getSettings(),
      listMilestones(),
      listCategories(),
      countTreatmentData(),
    ]);
    return { settings, milestones, categories, counts };
  });
  if (!result.ok) return <DataError message={result.error} />;
  const { settings, milestones, categories, counts } = result.data;
  const today = todayIso(settings.timeZone);

  const section = "p-4 sm:p-5";
  return (
    <div className="flex flex-col gap-5">
      <Card id="cirurgia">
        <CardHeader title="Cirurgia" description="Data de referência do contador de dias." icon={<HeartPulse className="size-4" />} />
        <div className={section}>
          <SurgeryDateForm surgeryDate={settings.surgeryDate} />
        </div>
      </Card>
      <Card id="marcos">
        <CardHeader title="Marcos temporais" description="Dias desde a cirurgia a acompanhar." icon={<Flag className="size-4" />} />
        <div className={section}>
          <MilestonesForm milestones={milestones} surgeryDate={settings.surgeryDate} serverToday={today} />
        </div>
      </Card>
      <Card id="geral">
        <CardHeader title="Configurações gerais" icon={<SlidersHorizontal className="size-4" />} />
        <div className={section}>
          <GeneralSettingsForm
            defaultCycleLimit={settings.defaultCycleLimit}
            defaultExtraAllowance={settings.defaultExtraAllowance}
            timeZone={settings.timeZone}
          />
        </div>
      </Card>
      <Card id="categorias">
        <CardHeader title="Categorias de treino" description="Frequência de uso e status." icon={<Tags className="size-4" />} />
        <div className={section}>
          <CategoryManager categories={categories} />
        </div>
      </Card>
      <Card id="aparencia">
        <CardHeader title="Preferências visuais" description="Salvo apenas neste navegador." icon={<Palette className="size-4" />} />
        <div className={section}>
          <ThemeToggle />
        </div>
      </Card>
      <Card id="backup">
        <CardHeader title="Backup e exportação" icon={<DatabaseBackup className="size-4" />} />
        <div className={section}>
          <BackupControls hasData={counts.sessions + counts.cycles + counts.bonuses > 0} />
        </div>
      </Card>
    </div>
  );
}
