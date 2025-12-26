import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted/60 animate-pulse rounded mt-2" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full bg-muted/30 animate-pulse rounded-lg flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Chargement du graphique...</div>
        </div>
      </CardContent>
    </Card>
  )
}
