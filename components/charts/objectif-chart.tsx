'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type ObjectifChartProps = {
  data: Array<{
    name: string
    Objectif: number
    Réalisé: number
    Potentiel: number
  }>
}

function ObjectifChartComponent({ data }: ObjectifChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Objectif vs Réalisé</CardTitle>
        <CardDescription>Comparaison annuelle</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
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
  )
}

export const ObjectifChart = React.memo(ObjectifChartComponent)
