'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/use-theme'

type Config = {
  id: string
  key: string
  value: number
  label: string
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<Config[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Record<string, number>>({})
  const { theme, toggleTheme, mounted } = useTheme()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data } = await supabase
      .from('config')
      .select('*')
      .order('key')

    if (data) {
      setConfigs(data)
      const formMap = data.reduce((acc, item) => {
        acc[item.key] = item.value
        return acc
      }, {} as Record<string, number>)
      setFormData(formMap)
    }
  }

  const handleSave = async () => {
    for (const config of configs) {
      await supabase
        .from('config')
        .update({ value: formData[config.key] })
        .eq('key', config.key)
    }
    setIsEditing(false)
    loadData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Configuration</h1>
        <p className="text-muted-foreground">Gérez les taux et paramètres de calcul</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Taux de calcul</CardTitle>
          <CardDescription>
            Ces taux sont utilisés pour les calculs automatiques des commissions et projections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                        setFormData({ ...formData, [config.key]: parseFloat(e.target.value) || 0 })
                      }
                      className="max-w-xs"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave}>Enregistrer</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
              </div>
            </>
          ) : (
            <>
              {configs.map((config) => (
                <div key={config.key} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{config.label}</span>
                  <span className="text-lg font-semibold">{config.value}%</span>
                </div>
              ))}
              <Button onClick={() => setIsEditing(true)} className="w-full mt-4">
                Modifier les taux
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mode sombre */}
      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>Personnalisez l'apparence de l'application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mode sombre</p>
              <p className="text-sm text-muted-foreground">
                Basculer entre le thème clair et sombre
              </p>
            </div>
            {mounted ? (
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={toggleTheme}
                className="min-w-[120px]"
              >
                {theme === 'dark' ? '🌙 Sombre' : '☀️ Clair'}
              </Button>
            ) : (
              <Button variant="outline" disabled className="min-w-[120px]">
                Chargement...
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Taux TVA %</strong> : Taxe sur la valeur ajoutée appliquée sur vos honoraires
          </p>
          <p>
            <strong>Taux Urssaf + PL %</strong> : Cotisations sociales (Urssaf + prélèvement libératoire) déduites de vos honoraires HT
          </p>
          <p className="pt-4 text-xs">
            Note : La modification de ces taux affectera tous les nouveaux calculs. Les mandats existants ne seront pas recalculés automatiquement.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
