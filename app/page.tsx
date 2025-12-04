'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type ProjectionCA = {
  id: string
  year: number
  objectif: number
  impot_annuel: number
}

type Mandat = {
  id: string
  statut: 'en_cours' | 'vendu' | 'annule' | 'potentiel'
  honoraires_moi_ht: number
  commission_nette: number
  taux_tva_fige: number | null
  taux_urssaf_fige: number | null
  date_signature: string
  date_compromis: string | null
}

export default function DashboardPage() {
  const [projection, setProjection] = useState<ProjectionCA | null>(null)
  const [mandats, setMandats] = useState<Mandat[]>([])
  const [isEditingObjectif, setIsEditingObjectif] = useState(false)
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    objectif: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const currentYear = new Date().getFullYear()

    // Charger la projection de l'année en cours
    const { data: projectionData } = await supabase
      .from('projections_ca')
      .select('*')
      .eq('year', currentYear)
      .single()

    if (projectionData) {
      setProjection(projectionData)
      setFormData({
        year: projectionData.year,
        objectif: projectionData.objectif,
      })
    }

    // Charger les mandats
    const { data: mandatsData } = await supabase
      .from('mandats')
      .select('id, statut, honoraires_moi_ht, commission_nette, taux_tva_fige, taux_urssaf_fige, date_signature, date_compromis')

    if (mandatsData) {
      // Charger les taux actuels pour recalculer les mandats en_cours et potentiel
      const { data: configData } = await supabase
        .from('config')
        .select('key, value')

      const config: Record<string, number> = {}
      if (configData) {
        configData.forEach(item => {
          config[item.key] = item.value
        })
      }

      const tauxURSSAF = config['taux_urssaf_pl'] || 26.8

      // Recalculer TOUTES les commissions avec le taux URSSAF actuel pour l'affichage
      // (les valeurs en base gardent les taux figés pour l'historique)
      const mandatsRecalcules = mandatsData.map(mandat => {
        const urssaf = mandat.honoraires_moi_ht * (tauxURSSAF / 100)
        const commissionNette = mandat.honoraires_moi_ht - urssaf

        return {
          ...mandat,
          commission_nette: commissionNette,
        }
      })

      setMandats(mandatsRecalcules)
    }
  }

  const handleSaveObjectif = async () => {
    if (projection) {
      await supabase
        .from('projections_ca')
        .update({ objectif: formData.objectif })
        .eq('id', projection.id)
    } else {
      await supabase
        .from('projections_ca')
        .insert([formData])
    }
    setIsEditingObjectif(false)
    loadData()
  }

  // Statistiques mandats
  const totalMandats = mandats.length
  const mandatsVendus = mandats.filter(m => m.statut === 'vendu').length
  const mandatsEnCours = mandats.filter(m => m.statut === 'en_cours').length
  const mandatsPotentiels = mandats.filter(m => m.statut === 'potentiel').length

  // CA Brut (honoraires HT des mandats vendus)
  const caBrut = mandats
    .filter(m => m.statut === 'vendu')
    .reduce((sum, m) => sum + m.honoraires_moi_ht, 0)

  // CA Net (commission nette après URSSAF des mandats vendus)
  const caNet = mandats
    .filter(m => m.statut === 'vendu')
    .reduce((sum, m) => sum + m.commission_nette, 0)

  // URSSAF total (CA Brut - CA Net)
  const urssafTotal = caBrut - caNet

  // CA Potentiel (honoraires HT des mandats potentiels)
  const caPotentiel = mandats
    .filter(m => m.statut === 'potentiel')
    .reduce((sum, m) => sum + m.honoraires_moi_ht, 0)

  // Taux de réalisation
  const tauxRealisation = projection && projection.objectif > 0
    ? (caBrut / projection.objectif) * 100
    : 0

  // Salaire mensuel net estimé = Total commission nette / 12
  const salaireMensuelNetEstime = caNet / 12

  // Impôt annuel calculé automatiquement (environ 30% du CA Net pour estimation)
  // AJUSTEZ CE TAUX selon votre situation fiscale réelle
  const TAUX_IMPOT_ESTIME = 30 // en pourcentage
  const impotAnnuelEstime = caNet * (TAUX_IMPOT_ESTIME / 100)

  // Données pour le graphique d'évolution mensuelle du CA
  const monthlyData = React.useMemo(() => {
    const months = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
    ]

    const data = months.map((month, index) => {
      const mandatsDuMois = mandats.filter(m => {
        if (m.statut !== 'vendu' || !m.date_compromis) return false
        const date = new Date(m.date_compromis)
        return date.getMonth() === index && date.getFullYear() === formData.year
      })

      const caMois = mandatsDuMois.reduce((sum, m) => sum + m.honoraires_moi_ht, 0)
      const caNetMois = mandatsDuMois.reduce((sum, m) => sum + m.commission_nette, 0)

      return {
        mois: month,
        'CA Brut': Math.round(caMois),
        'CA Net': Math.round(caNetMois),
      }
    })

    return data
  }, [mandats, formData.year])

  // Données pour le graphique objectif vs réalisé
  const objectifData = [
    {
      name: 'CA Annuel',
      'Objectif': projection?.objectif || 0,
      'Réalisé': Math.round(caBrut),
      'Potentiel': Math.round(caPotentiel),
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-primary">Dashboard {formData.year}</h1>
        <p className="text-muted-foreground mt-1">Vue d&apos;ensemble de votre activité immobilière</p>
      </div>

      {/* KPIs Principaux - Grande grille */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs uppercase tracking-wide">Total Mandats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-primary">{totalMandats}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {mandatsVendus} vendus • {mandatsEnCours} en cours
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-transparent">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs uppercase tracking-wide">Mandats Vendus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-green-600">{mandatsVendus}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {mandatsVendus > 0 ? ((mandatsVendus / totalMandats) * 100).toFixed(0) : 0}% du total
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs uppercase tracking-wide">En Cours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-blue-600">{mandatsEnCours}</div>
            <p className="text-xs text-muted-foreground mt-2">Mandats actifs</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-transparent">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs uppercase tracking-wide">Potentiels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-yellow-600">{mandatsPotentiels}</div>
            <p className="text-xs text-muted-foreground mt-2">À développer</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques d'évolution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Graphique courbe - Évolution mensuelle du CA */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution mensuelle du CA</CardTitle>
            <CardDescription>CA Brut et Net par mois en {formData.year}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`}
                />
                <Legend />
                <Line type="monotone" dataKey="CA Brut" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="CA Net" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Graphique barres - Objectif vs Réalisé */}
        <Card>
          <CardHeader>
            <CardTitle>Objectif vs Réalisé</CardTitle>
            <CardDescription>Comparaison annuelle</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={objectifData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`}
                />
                <Legend />
                <Bar dataKey="Objectif" fill="hsl(var(--primary))" />
                <Bar dataKey="Réalisé" fill="hsl(142, 76%, 36%)" />
                <Bar dataKey="Potentiel" fill="hsl(48, 96%, 53%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* CA Statistics - Cartes plus grandes et stylées */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">CA Brut</CardTitle>
            <CardDescription>Honoraires HT vendus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              {caBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            {projection && projection.objectif > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Objectif</span>
                  <span className="font-semibold">{projection.objectif.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${Math.min(tauxRealisation, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-primary font-bold text-right">
                  {tauxRealisation.toFixed(1)}% réalisé
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">CA Net</CardTitle>
            <CardDescription>Après Urssaf + PL</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600 mb-2">
              {caNet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between p-2 bg-white/50 dark:bg-white/5 rounded">
                <span className="text-muted-foreground">CA Brut</span>
                <span className="font-semibold">{caBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between p-2 bg-red-50/80 dark:bg-red-900/10 rounded">
                <span className="text-muted-foreground">- URSSAF + PL</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{urssafTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Taux de marge net</span>
                <span>{caBrut > 0 ? ((caNet / caBrut) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50/50 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">CA Potentiel</CardTitle>
            <CardDescription>Mandats potentiels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-yellow-600 mb-2">
              {caPotentiel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <p className="text-sm text-muted-foreground">
              {mandatsPotentiels} mandat{mandatsPotentiels > 1 ? 's' : ''} en attente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenus & Fiscalité */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>💰</span>
              Salaire Mensuel Net Estimé
            </CardTitle>
            <CardDescription>Calculé automatiquement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-purple-600 mb-4">
              {salaireMensuelNetEstime.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-white rounded">
                <span className="text-muted-foreground">CA Net total</span>
                <span className="font-semibold">{caNet.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between p-2 bg-white rounded">
                <span className="text-muted-foreground">Divisé par</span>
                <span className="font-semibold">12 mois</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50/50 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🧾</span>
              Impôt sur le Revenu (IR) - Estimation
            </CardTitle>
            <CardDescription>Calculé sur votre CA Net après URSSAF</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-red-600 mb-4">
              {impotAnnuelEstime.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-white/70 dark:bg-white/5 rounded">
                <span className="text-muted-foreground">CA Net annuel (après URSSAF)</span>
                <span className="font-semibold">{caNet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between p-2 bg-red-50/80 dark:bg-red-900/10 rounded">
                <span className="text-muted-foreground">× Taux d'imposition estimé</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{TAUX_IMPOT_ESTIME}%</span>
              </div>
              <div className="h-px bg-border my-2"></div>
              <div className="flex justify-between p-2 bg-blue-50/80 dark:bg-blue-900/10 rounded">
                <span className="text-muted-foreground font-medium">Impôt mensuel estimé</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{(impotAnnuelEstime / 12).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €/mois</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                ⚠️ Estimation indicative - Le taux réel dépend de votre situation fiscale (parts, revenus du foyer, etc.)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Objectif de l'année */}
      <Card>
        <CardHeader>
          <CardTitle>Objectif CA {formData.year}</CardTitle>
          <CardDescription>Définissez votre cible annuelle</CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingObjectif ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="objectif">Objectif de chiffre d&apos;affaires</Label>
                <Input
                  id="objectif"
                  type="number"
                  step="0.01"
                  value={formData.objectif}
                  onChange={(e) => setFormData({ ...formData, objectif: parseFloat(e.target.value) || 0 })}
                  className="text-lg"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveObjectif}>Enregistrer</Button>
                <Button variant="outline" onClick={() => setIsEditingObjectif(false)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Objectif annuel</p>
                  <p className="text-3xl font-bold text-primary">{formData.objectif.toLocaleString('fr-FR')} €</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Restant à réaliser</p>
                  <p className="text-2xl font-bold text-muted-foreground">
                    {Math.max(0, formData.objectif - caBrut).toLocaleString('fr-FR')} €
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsEditingObjectif(true)} variant="outline" className="w-full">
                Modifier l&apos;objectif
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
