"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/use-theme";

type Config = {
  id: string;
  key: string;
  value: number;
  label: string;
};

export default function ConfigPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, number>>({});
  const { theme, toggleTheme, mounted } = useTheme();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data } = await supabase.from("config").select("*").order("key");

    if (data) {
      setConfigs(data);
      const formMap = data.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, number>);
      setFormData(formMap);
    }
  };

  const handleSave = async () => {
    for (const config of configs) {
      await supabase
        .from("config")
        .update({ value: formData[config.key] })
        .eq("key", config.key);
    }
    setIsEditing(false);
    loadData();
  };

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-xl p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
        <h1 className="text-5xl font-bold tracking-tight text-primary">Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Gérez les taux et paramètres de calcul
        </p>
      </div>

      <Card className="transition-all duration-300 hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle>Taux de calcul</CardTitle>
          <CardDescription>
            Ces taux sont utilisés pour les calculs automatiques des commissions
            et projections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 px-8 pb-8">
          {isEditing ? (
            <>
              {configs.map((config) => (
                <div key={config.key} className="space-y-2">
                  <Label htmlFor={config.key}>{config.label}</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id={config.key}
                      type="number"
                      step="0.01"
                      value={formData[config.key] || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [config.key]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="max-w-xs"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="transition-all duration-200 active:scale-95">Enregistrer</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="transition-all duration-200 active:scale-95">
                  Annuler
                </Button>
              </div>
            </>
          ) : (
            <>
              {configs.map((config) => (
                <div
                  key={config.key}
                  className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm text-muted-foreground">
                    {config.label}
                  </span>
                  <span className="text-lg font-semibold text-primary">{config.value}%</span>
                </div>
              ))}
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full mt-4 transition-all duration-200 active:scale-95"
              >
                Modifier les taux
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mode sombre */}
      <Card className="transition-all duration-300 hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle>Apparence</CardTitle>
          <CardDescription>
            Personnalisez l&apos;apparence de l&apos;application
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 px-8 pb-8">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium">Mode sombre</p>
              <p className="text-sm text-muted-foreground">
                Basculer entre le thème clair et sombre
              </p>
            </div>
            {mounted ? (
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={toggleTheme}
                className="min-w-[120px] transition-all duration-200 active:scale-95"
              >
                {theme === "dark" ? "🌙 Sombre" : "☀️ Clair"}
              </Button>
            ) : (
              <Button variant="outline" disabled className="min-w-[120px]">
                Chargement...
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-[hsl(var(--chart-3))]/20 bg-gradient-to-br from-[hsl(var(--chart-3))]/5 to-transparent">
        <CardHeader className="pb-4">
          <CardTitle>Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground pt-2 px-8 pb-8">
          <p>
            <strong>Taux TVA %</strong> : Taxe sur la valeur ajoutée appliquée
            sur vos honoraires
          </p>
          <p>
            <strong>Taux Urssaf + PL %</strong> : Cotisations sociales (Urssaf +
            prélèvement libératoire) déduites de vos honoraires HT
          </p>
          <p className="pt-4 text-xs">
            Note : La modification de ces taux affectera tous les nouveaux
            calculs. Les mandats existants ne seront pas recalculés
            automatiquement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
