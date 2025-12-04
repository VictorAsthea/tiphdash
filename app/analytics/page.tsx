'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Mandat = {
  id: string
  statut: 'en_cours' | 'vendu' | 'annule' | 'potentiel'
  typologie: 'exclusif' | 'semi_exclusif' | 'co_exclusif' | 'simple'
  honoraires_moi_ht: number
  commission_nette: number
  date_signature: string
  date_compromis: string | null
  taux_tva_fige: number | null
  taux_urssaf_fige: number | null
}

const COLORS = {
  vendu: 'hsl(142, 76%, 36%)',
  en_cours: 'hsl(221, 83%, 53%)',
  potentiel: 'hsl(48, 96%, 53%)',
  annule: 'hsl(0, 84%, 60%)',
}

const TYPOLOGIE_COLORS = {
  exclusif: 'hsl(var(--primary))',
  semi_exclusif: 'hsl(142, 76%, 36%)',
  co_exclusif: 'hsl(221, 83%, 53%)',
  simple: 'hsl(48, 96%, 53%)',
}

export default function AnalyticsPage() {
  const [mandats, setMandats] = useState<Mandat[]>([])
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadData()
  }, [year])

  const loadData = async () => {
    const { data: mandatsData } = await supabase
      .from('mandats')
      .select('*')

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

      // Recalculer les commissions
      const mandatsRecalcules = mandatsData.map(mandat => {
        if (mandat.statut === 'vendu' && mandat.taux_urssaf_fige) {
          return mandat
        }
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

  // Données pour le camembert des statuts
  const statutData = [
    { name: 'Vendus', value: mandats.filter(m => m.statut === 'vendu').length, color: COLORS.vendu },
    { name: 'En cours', value: mandats.filter(m => m.statut === 'en_cours').length, color: COLORS.en_cours },
    { name: 'Potentiels', value: mandats.filter(m => m.statut === 'potentiel').length, color: COLORS.potentiel },
    { name: 'Annulés', value: mandats.filter(m => m.statut === 'annule').length, color: COLORS.annule },
  ].filter(item => item.value > 0)

  // Données pour le camembert des typologies
  const typologieData = [
    { name: 'Exclusif', value: mandats.filter(m => m.typologie === 'exclusif').length, color: TYPOLOGIE_COLORS.exclusif },
    { name: 'Semi-exclusif', value: mandats.filter(m => m.typologie === 'semi_exclusif').length, color: TYPOLOGIE_COLORS.semi_exclusif },
    { name: 'Co-exclusif', value: mandats.filter(m => m.typologie === 'co_exclusif').length, color: TYPOLOGIE_COLORS.co_exclusif },
    { name: 'Simple', value: mandats.filter(m => m.typologie === 'simple').length, color: TYPOLOGIE_COLORS.simple },
  ].filter(item => item.value > 0)

  // CA moyen par typologie
  const caMoyenParTypologie = [
    { name: 'Exclusif', ca: 0, count: 0 },
    { name: 'Semi-exclusif', ca: 0, count: 0 },
    { name: 'Co-exclusif', ca: 0, count: 0 },
    { name: 'Simple', ca: 0, count: 0 },
  ]

  mandats.filter(m => m.statut === 'vendu').forEach(m => {
    const index = caMoyenParTypologie.findIndex(item => {
      if (m.typologie === 'exclusif') return item.name === 'Exclusif'
      if (m.typologie === 'semi_exclusif') return item.name === 'Semi-exclusif'
      if (m.typologie === 'co_exclusif') return item.name === 'Co-exclusif'
      if (m.typologie === 'simple') return item.name === 'Simple'
      return false
    })
    if (index !== -1) {
      caMoyenParTypologie[index].ca += m.honoraires_moi_ht
      caMoyenParTypologie[index].count += 1
    }
  })

  const caMoyenData = caMoyenParTypologie
    .filter(item => item.count > 0)
    .map(item => ({
      name: item.name,
      'CA Moyen': Math.round(item.ca / item.count),
    }))

  // Évolution cumulative du CA
  const mandatsVendusTriés = [...mandats]
    .filter(m => m.statut === 'vendu' && m.date_compromis)
    .sort((a, b) => new Date(a.date_compromis!).getTime() - new Date(b.date_compromis!).getTime())

  let caCumul = 0
  const evolutionCumulative = mandatsVendusTriés.map(m => {
    caCumul += m.honoraires_moi_ht
    return {
      date: new Date(m.date_compromis!).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      'CA Cumulé': Math.round(caCumul),
    }
  })

  // Statistiques générales
  const totalMandats = mandats.length
  const mandatsVendus = mandats.filter(m => m.statut === 'vendu').length
  const tauxConversion = totalMandats > 0 ? (mandatsVendus / totalMandats * 100) : 0
  const caTotal = mandats.filter(m => m.statut === 'vendu').reduce((sum, m) => sum + m.honoraires_moi_ht, 0)
  const caMoyen = mandatsVendus > 0 ? caTotal / mandatsVendus : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-primary">Analytics</h1>
        <p className="text-muted-foreground mt-1">Analyses détaillées de votre activité</p>
      </div>

      {/* KPIs généraux */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Taux de conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{tauxConversion.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mandatsVendus} / {totalMandats} mandats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">CA Moyen par vente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {caMoyen.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Honoraires HT moyens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">CA Total réalisé</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {caTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sur {mandatsVendus} ventes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Mandats actifs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {mandats.filter(m => m.statut === 'en_cours').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              En cours de traitement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques principaux */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Répartition par statut */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par statut</CardTitle>
            <CardDescription>Distribution de tous les mandats</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statutData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Répartition par typologie */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par typologie</CardTitle>
            <CardDescription>Types de mandats gérés</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typologieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typologieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Analyses avancées */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CA moyen par typologie */}
        {caMoyenData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>CA Moyen par typologie</CardTitle>
              <CardDescription>Rentabilité par type de mandat (vendus)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={caMoyenData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`} />
                  <Bar dataKey="CA Moyen" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Évolution cumulative */}
        {evolutionCumulative.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Évolution cumulative du CA</CardTitle>
              <CardDescription>Progression du CA au fil des ventes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolutionCumulative}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`} />
                  <Line type="monotone" dataKey="CA Cumulé" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
