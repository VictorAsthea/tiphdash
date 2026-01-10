'use client'

import React, { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChartSkeleton } from '@/components/charts/chart-skeleton'
import { AlertCircle } from 'lucide-react'

// Lazy loading des graphiques pour performance
const MonthlyChart = dynamic(
  () => import('@/components/charts/monthly-chart').then(mod => ({ default: mod.MonthlyChart })),
  { loading: () => <ChartSkeleton />, ssr: false }
)

const ObjectifChart = dynamic(
  () => import('@/components/charts/objectif-chart').then(mod => ({ default: mod.ObjectifChart })),
  { loading: () => <ChartSkeleton />, ssr: false }
)

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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    objectif: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const currentYear = new Date().getFullYear()

      // Charger la projection de l'année en cours
      const { data: projectionData, error: projectionError } = await supabase
        .from('projections_ca')
        .select('*')
        .eq('year', currentYear)
        .single()

      // PGRST116 = pas de résultat (normal si pas encore de projection)
      if (projectionError && projectionError.code !== 'PGRST116') {
        console.error('Erreur chargement projection:', projectionError)
        setError('Erreur lors du chargement des projections')
        setIsLoading(false)
        return
      }

      if (projectionData) {
        setProjection(projectionData)
        setFormData({
          year: projectionData.year,
          objectif: projectionData.objectif,
        })
      }

      // Charger les mandats
      const { data: mandatsData, error: mandatsError } = await supabase
        .from('mandats')
        .select('id, statut, honoraires_moi_ht, commission_nette, taux_tva_fige, taux_urssaf_fige, date_signature, date_compromis')

      if (mandatsError) {
        console.error('Erreur chargement mandats:', mandatsError)
        setError('Erreur lors du chargement des mandats')
        setIsLoading(false)
        return
      }

      if (mandatsData) {
        // Charger les taux actuels pour recalculer les mandats en_cours et potentiel
        const { data: configData, error: configError } = await supabase
          .from('config')
          .select('key, value')

        if (configError) {
          console.error('Erreur chargement config:', configError)
          setError('Erreur lors du chargement de la configuration')
          setIsLoading(false)
          return
        }

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
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur inattendue est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveObjectif = async () => {
    try {
      if (projection) {
        const { error } = await supabase
          .from('projections_ca')
          .update({ objectif: formData.objectif })
          .eq('id', projection.id)

        if (error) {
          console.error('Erreur mise à jour objectif:', error)
          setError('Erreur lors de la mise à jour de l\'objectif')
          return
        }
      } else {
        const { error } = await supabase
          .from('projections_ca')
          .insert([formData])

        if (error) {
          console.error('Erreur création objectif:', error)
          setError('Erreur lors de la création de l\'objectif')
          return
        }
      }
      setIsEditingObjectif(false)
      loadData()
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur inattendue est survenue')
    }
  }

  // Mémoization des statistiques pour optimiser les performances
  const stats = useMemo(() => {
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

    // URSSAF estimé sur les mandats en cours et potentiels
    const caBrutEnCoursPotentiel = mandats
      .filter(m => m.statut === 'en_cours' || m.statut === 'potentiel')
      .reduce((sum, m) => sum + m.honoraires_moi_ht, 0)

    const urssafEstimeEnCoursPotentiel = caBrutEnCoursPotentiel - mandats
      .filter(m => m.statut === 'en_cours' || m.statut === 'potentiel')
      .reduce((sum, m) => sum + m.commission_nette, 0)

    return {
      totalMandats,
      mandatsVendus,
      mandatsEnCours,
      mandatsPotentiels,
      caBrut,
      caNet,
      urssafTotal,
      caPotentiel,
      tauxRealisation,
      salaireMensuelNetEstime,
      caBrutEnCoursPotentiel,
      urssafEstimeEnCoursPotentiel,
    }
  }, [mandats, projection])

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
  const objectifData = useMemo(() => [
    {
      name: 'CA Annuel',
      'Objectif': projection?.objectif || 0,
      'Réalisé': Math.round(stats.caBrut),
      'Potentiel': Math.round(stats.caPotentiel),
    }
  ], [projection, stats.caBrut, stats.caPotentiel])

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div className="relative overflow-hidden rounded-xl p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
          <h1 className="text-5xl font-bold tracking-tight text-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Chargement...</p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-4">
                <div className="h-4 bg-muted rounded w-24"></div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-12 bg-muted rounded w-16"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-10">
        <div className="relative overflow-hidden rounded-xl p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
          <h1 className="text-5xl font-bold tracking-tight text-primary">Dashboard</h1>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground mt-1">Vérifiez votre connexion et réessayez.</p>
              </div>
            </div>
            <Button onClick={loadData} variant="outline" className="mt-4">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-xl p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
        <h1 className="text-5xl font-bold tracking-tight text-primary">Dashboard {formData.year}</h1>
        <p className="text-muted-foreground mt-1">Vue d&apos;ensemble de votre activité immobilière</p>
      </div>

      {/* KPIs Principaux - Grande grille */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardDescription className="text-xs uppercase tracking-wide font-medium">Total Mandats</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-6xl font-bold tracking-tighter text-primary">{stats.totalMandats}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.mandatsVendus} vendus • {stats.mandatsEnCours} en cours
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-[hsl(var(--chart-2))]/20 bg-gradient-to-br from-[hsl(var(--chart-2))]/5 to-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardDescription className="text-xs uppercase tracking-wide font-medium">Mandats Vendus</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-6xl font-bold tracking-tighter text-[hsl(var(--chart-2))]">{stats.mandatsVendus}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.mandatsVendus > 0 ? ((stats.mandatsVendus / stats.totalMandats) * 100).toFixed(0) : 0}% du total
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-[hsl(var(--chart-3))]/20 bg-gradient-to-br from-[hsl(var(--chart-3))]/5 to-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardDescription className="text-xs uppercase tracking-wide font-medium">En Cours</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-6xl font-bold tracking-tighter text-[hsl(var(--chart-3))]">{stats.mandatsEnCours}</div>
            <p className="text-xs text-muted-foreground mt-2">Mandats actifs</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-[hsl(var(--chart-4))]/20 bg-gradient-to-br from-[hsl(var(--chart-4))]/5 to-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardDescription className="text-xs uppercase tracking-wide font-medium">Potentiels</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-6xl font-bold tracking-tighter text-[hsl(var(--chart-4))]">{stats.mandatsPotentiels}</div>
            <p className="text-xs text-muted-foreground mt-2">À développer</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques d'évolution */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Graphique courbe - Évolution mensuelle du CA */}
        <MonthlyChart data={monthlyData} year={formData.year} />

        {/* Graphique barres - Objectif vs Réalisé */}
        <ObjectifChart data={objectifData} />
      </div>

      {/* CA Statistics - Cartes plus grandes et stylées */}
      <div className="grid gap-8 md:grid-cols-3">
        <Card className="border-2 border-primary/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">CA Brut</CardTitle>
            <CardDescription>Honoraires HT vendus</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 px-8 pb-8">
            <div className="text-4xl font-bold text-primary mb-2">
              {stats.caBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            {projection && projection.objectif > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Objectif</span>
                  <span className="font-semibold">{projection.objectif.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-4 overflow-hidden backdrop-blur-sm">
                  <div
                    className="bg-gradient-to-r from-primary to-primary/80 h-full rounded-full transition-all duration-700 ease-out shadow-lg"
                    style={{ width: `${Math.min(stats.tauxRealisation, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-primary font-bold text-right">
                  {stats.tauxRealisation.toFixed(1)}% réalisé
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-[hsl(var(--chart-2))]/20 bg-gradient-to-br from-[hsl(var(--chart-2))]/5 to-transparent backdrop-blur-sm bg-card/95 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">CA Net</CardTitle>
            <CardDescription>Après Urssaf + PL</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 px-8 pb-8">
            <div className="text-4xl font-bold text-[hsl(var(--chart-2))] mb-2">
              {stats.caNet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between p-2 bg-white/50 dark:bg-white/5 rounded">
                <span className="text-muted-foreground">CA Brut</span>
                <span className="font-semibold">{stats.caBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between p-2 bg-red-50/80 dark:bg-red-900/10 rounded">
                <span className="text-muted-foreground">- URSSAF + PL</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{stats.urssafTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Taux de marge net</span>
                <span>{stats.caBrut > 0 ? ((stats.caNet / stats.caBrut) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[hsl(var(--chart-4))]/20 bg-gradient-to-br from-[hsl(var(--chart-4))]/5 to-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">CA Potentiel</CardTitle>
            <CardDescription>Mandats potentiels</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 px-8 pb-8">
            <div className="text-4xl font-bold text-[hsl(var(--chart-4))] mb-2">
              {stats.caPotentiel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <p className="text-sm text-muted-foreground">
              {stats.mandatsPotentiels} mandat{stats.mandatsPotentiels > 1 ? 's' : ''} en attente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenus & Fiscalité */}
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="border-2 border-[hsl(var(--chart-5))]/20 bg-gradient-to-br from-[hsl(var(--chart-5))]/5 to-transparent backdrop-blur-sm bg-card/95 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <span>💰</span>
              Salaire Mensuel Net Estimé
            </CardTitle>
            <CardDescription>Calculé automatiquement</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 px-8 pb-8">
            <div className="text-5xl font-bold text-[hsl(var(--chart-5))] mb-4">
              {stats.salaireMensuelNetEstime.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-white/50 dark:bg-white/5 rounded">
                <span className="text-muted-foreground">CA Net total</span>
                <span className="font-semibold">{stats.caNet.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between p-2 bg-white/50 dark:bg-white/5 rounded">
                <span className="text-muted-foreground">Divisé par</span>
                <span className="font-semibold">12 mois</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[hsl(var(--chart-3))]/20 bg-gradient-to-br from-[hsl(var(--chart-3))]/5 to-transparent backdrop-blur-sm bg-card/95 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <span>📊</span>
              URSSAF à prévoir (En cours + Potentiel)
            </CardTitle>
            <CardDescription>Estimation sur les mandats non vendus</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 px-8 pb-8">
            <div className="text-5xl font-bold text-[hsl(var(--chart-3))] mb-4">
              {stats.urssafEstimeEnCoursPotentiel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-white/50 dark:bg-white/5 rounded">
                <span className="text-muted-foreground">CA Brut (En cours + Potentiel)</span>
                <span className="font-semibold">{stats.caBrutEnCoursPotentiel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between p-2 bg-[hsl(var(--chart-3))]/10 dark:bg-[hsl(var(--chart-3))]/10 rounded">
                <span className="text-muted-foreground">URSSAF estimé à payer</span>
                <span className="font-semibold text-[hsl(var(--chart-3))]">{stats.urssafEstimeEnCoursPotentiel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="h-px bg-border my-2"></div>
              <div className="flex justify-between p-2 bg-[hsl(var(--chart-2))]/10 dark:bg-[hsl(var(--chart-2))]/10 rounded">
                <span className="text-muted-foreground font-medium">CA Net potentiel</span>
                <span className="font-bold text-[hsl(var(--chart-2))]">{(stats.caBrutEnCoursPotentiel - stats.urssafEstimeEnCoursPotentiel).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                💡 Calculé avec le taux URSSAF actuel de la configuration
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Objectif de l'année */}
      <Card className="transition-all duration-300 hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle>Objectif CA {formData.year}</CardTitle>
          <CardDescription>Définissez votre cible annuelle</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 px-8 pb-8">
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
                <Button onClick={handleSaveObjectif} className="transition-all duration-200 active:scale-95">
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setIsEditingObjectif(false)} className="transition-all duration-200 active:scale-95">
                  Annuler
                </Button>
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
                    {Math.max(0, formData.objectif - stats.caBrut).toLocaleString('fr-FR')} €
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsEditingObjectif(true)} variant="outline" className="w-full transition-all duration-200 active:scale-95">
                Modifier l&apos;objectif
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
