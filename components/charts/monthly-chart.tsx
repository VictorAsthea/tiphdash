'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type MonthlyChartProps = {
  data: Array<{
    mois: string
    'CA Brut': number
    'CA Net': number
  }>
  year: number
}

function MonthlyChartComponent({ data, year }: MonthlyChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution mensuelle du CA</CardTitle>
        <CardDescription>CA Brut et Net par mois en {year}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
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
  )
}

export const MonthlyChart = React.memo(MonthlyChartComponent)
