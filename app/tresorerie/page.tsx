'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Loader2 } from 'lucide-react'

type Transaction = {
  id: string
  date_operation: string
  debit: number
  credit: number
  info_transaction: string
  solde?: number
}

export default function TresoreriePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [typeOperation, setTypeOperation] = useState<'credit' | 'debit'>('credit')
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState<string>('tous')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    date_operation: new Date().toISOString().split('T')[0],
    montant: 0,
    info_transaction: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: loadError } = await supabase
        .from('tresorerie')
        .select('*')
        .order('date_operation', { ascending: true })
        .order('created_at', { ascending: true })

      if (loadError) {
        console.error('Erreur chargement trésorerie:', loadError)
        setError('Erreur lors du chargement des transactions')
        return
      }

      if (data) {
        // Calculer le solde cumulé pour chaque transaction
        let soldeActuel = 0
        const transactionsAvecSolde = data.map((transaction) => {
          soldeActuel += transaction.credit - transaction.debit
          return {
            ...transaction,
            solde: soldeActuel,
          }
        })
        setTransactions(transactionsAvecSolde)
      }
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur inattendue est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const transactionData = {
        date_operation: formData.date_operation,
        debit: typeOperation === 'debit' ? formData.montant : 0,
        credit: typeOperation === 'credit' ? formData.montant : 0,
        info_transaction: formData.info_transaction,
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('tresorerie')
          .update(transactionData)
          .eq('id', editingId)

        if (updateError) {
          console.error('Erreur mise à jour:', updateError)
          setError(`Erreur lors de la mise à jour: ${updateError.message}`)
          return
        }
      } else {
        const { error: insertError } = await supabase
          .from('tresorerie')
          .insert([transactionData])

        if (insertError) {
          console.error('Erreur insertion:', insertError)
          setError(`Erreur lors de l'ajout: ${insertError.message}`)
          return
        }
      }

      setIsAdding(false)
      setEditingId(null)
      resetForm()
      loadData()
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Une erreur inattendue est survenue')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (transaction: Transaction) => {
    const isDebit = transaction.debit > 0
    setTypeOperation(isDebit ? 'debit' : 'credit')
    setFormData({
      date_operation: transaction.date_operation,
      montant: isDebit ? transaction.debit : transaction.credit,
      info_transaction: transaction.info_transaction,
    })
    setEditingId(transaction.id)
    setIsAdding(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      try {
        const { error: deleteError } = await supabase
          .from('tresorerie')
          .delete()
          .eq('id', id)

        if (deleteError) {
          console.error('Erreur suppression:', deleteError)
          setError(`Erreur lors de la suppression: ${deleteError.message}`)
          return
        }

        loadData()
      } catch (err) {
        console.error('Erreur inattendue:', err)
        setError('Une erreur inattendue est survenue')
      }
    }
  }

  const resetForm = () => {
    setFormData({
      date_operation: new Date().toISOString().split('T')[0],
      montant: 0,
      info_transaction: '',
    })
    setTypeOperation('credit')
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatMontant = (montant: number) => {
    return montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Filtrer les transactions par année et mois
  const transactionsFiltrees = transactions.filter(t => {
    const dateTransaction = new Date(t.date_operation)
    const yearMatch = dateTransaction.getFullYear().toString() === selectedYear

    if (selectedMonth === 'tous') {
      return yearMatch
    }

    const monthMatch = (dateTransaction.getMonth() + 1).toString() === selectedMonth
    return yearMatch && monthMatch
  })

  // Calculer le solde initial (somme des transactions avant la période filtrée)
  const soldeInitial = transactions
    .filter(t => {
      const dateTransaction = new Date(t.date_operation)
      const transactionYear = dateTransaction.getFullYear()
      const transactionMonth = dateTransaction.getMonth() + 1

      if (selectedMonth === 'tous') {
        // Transactions des années précédentes
        return transactionYear < parseInt(selectedYear)
      } else {
        // Transactions avant le mois sélectionné (même année ou années précédentes)
        return (
          transactionYear < parseInt(selectedYear) ||
          (transactionYear === parseInt(selectedYear) && transactionMonth < parseInt(selectedMonth))
        )
      }
    })
    .reduce((sum, t) => sum + t.credit - t.debit, 0)

  // Recalculer le solde pour les transactions filtrées en partant du solde initial
  let soldeCumule = soldeInitial
  const transactionsFiltreesAvecSolde = transactionsFiltrees.map(t => {
    soldeCumule += t.credit - t.debit
    return { ...t, solde: soldeCumule }
  })

  // Obtenir les années disponibles
  const anneesDisponibles = Array.from(
    new Set(transactions.map(t => new Date(t.date_operation).getFullYear()))
  ).sort((a, b) => b - a)

  const moisDisponibles = [
    { value: 'tous', label: 'Toute l\'année' },
    { value: '1', label: 'Janvier' },
    { value: '2', label: 'Février' },
    { value: '3', label: 'Mars' },
    { value: '4', label: 'Avril' },
    { value: '5', label: 'Mai' },
    { value: '6', label: 'Juin' },
    { value: '7', label: 'Juillet' },
    { value: '8', label: 'Août' },
    { value: '9', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ]

  const soldeActuel = transactionsFiltreesAvecSolde.length > 0
    ? transactionsFiltreesAvecSolde[transactionsFiltreesAvecSolde.length - 1].solde || 0
    : 0
  const totalCredits = transactionsFiltreesAvecSolde.reduce((sum, t) => sum + t.credit, 0)
  const totalDebits = transactionsFiltreesAvecSolde.reduce((sum, t) => sum + t.debit, 0)

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div className="relative overflow-hidden rounded-xl p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
          <h1 className="text-5xl font-bold tracking-tight text-primary">Trésorerie</h1>
          <p className="text-muted-foreground mt-1">Chargement...</p>
        </div>
        <div className="grid gap-8 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-4">
                <div className="h-4 bg-muted rounded w-24"></div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-10 bg-muted rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center gap-4">
        <div className="relative overflow-hidden rounded-xl p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10 flex-1">
          <h1 className="text-5xl font-bold tracking-tight text-primary">Trésorerie</h1>
          <p className="text-muted-foreground mt-1">Suivi de vos flux financiers</p>
        </div>
        <Button onClick={() => setIsAdding(true)} size="lg" className="transition-all duration-200 active:scale-95">
          + Nouvelle transaction
        </Button>
      </div>

      {/* Message d'erreur */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">{error}</p>
              </div>
              <Button onClick={() => setError(null)} variant="ghost" size="sm">
                Fermer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtres */}
      <Card className="transition-all duration-300 hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Sélectionnez une période</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Année</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anneesDisponibles.length === 0 ? (
                    <SelectItem value={new Date().getFullYear().toString()}>
                      {new Date().getFullYear()}
                    </SelectItem>
                  ) : (
                    anneesDisponibles.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mois</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {moisDisponibles.map(mois => (
                    <SelectItem key={mois.value} value={mois.value}>
                      {mois.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            📊 {transactionsFiltreesAvecSolde.length} transaction{transactionsFiltreesAvecSolde.length > 1 ? 's' : ''}
            {selectedMonth !== 'tous' && ` en ${moisDisponibles.find(m => m.value === selectedMonth)?.label}`} {selectedYear}
          </p>
        </CardContent>
      </Card>

      {/* Indicateurs principaux */}
      <div className="grid gap-8 md:grid-cols-4">
        {soldeInitial !== 0 && (
          <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <CardHeader className="pb-4">
              <CardDescription className="text-xs uppercase tracking-wide font-medium">Solde de Début</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className={`text-4xl font-bold tracking-tighter ${soldeInitial >= 0 ? 'text-[hsl(var(--chart-2))]' : 'text-destructive'}`}>
                {soldeInitial >= 0 ? '+' : ''}{formatMontant(soldeInitial)} €
              </div>
              <p className="text-xs text-muted-foreground mt-1">Report période précédente</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-2 border-primary/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardDescription className="text-xs uppercase tracking-wide font-medium">Solde de Fin</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className={`text-5xl font-bold tracking-tighter ${soldeActuel >= 0 ? 'text-[hsl(var(--chart-2))]' : 'text-destructive'}`}>
              {soldeActuel >= 0 ? '+' : ''}{formatMontant(soldeActuel)} €
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardDescription className="text-xs uppercase tracking-wide font-medium">Total Crédits</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold tracking-tighter text-[hsl(var(--chart-2))]">
              +{formatMontant(totalCredits)} €
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="pb-4">
            <CardDescription className="text-xs uppercase tracking-wide font-medium">Total Débits</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold tracking-tighter text-destructive">
              -{formatMontant(totalDebits)} €
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire d'ajout */}
      {isAdding && (
        <Card className="border-2 border-primary/30 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle>{editingId ? 'Modifier' : 'Ajouter'} une transaction</CardTitle>
            <CardDescription>Enregistrez une opération de trésorerie</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type_operation">Type d&apos;opération</Label>
                <Select value={typeOperation} onValueChange={(value: any) => setTypeOperation(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">
                      <span className="text-[hsl(var(--chart-2))] font-medium">Crédit (Entrée d&apos;argent)</span>
                    </SelectItem>
                    <SelectItem value="debit">
                      <span className="text-destructive font-medium">Débit (Sortie d&apos;argent)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_operation">Date de l&apos;opération</Label>
                <Input
                  id="date_operation"
                  type="date"
                  value={formData.date_operation}
                  onChange={(e) => setFormData({ ...formData, date_operation: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="montant">Montant</Label>
                <Input
                  id="montant"
                  type="number"
                  step="0.01"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })}
                  required
                  className="text-lg font-semibold"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="info_transaction">Information de la transaction</Label>
                <Input
                  id="info_transaction"
                  value={formData.info_transaction}
                  onChange={(e) => setFormData({ ...formData, info_transaction: e.target.value })}
                  placeholder="Ex: Commission mandat #2234, Salaire octobre, etc."
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleSave} size="lg" disabled={isSaving} className="transition-all duration-200 active:scale-95">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  editingId ? 'Mettre à jour' : 'Enregistrer'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false)
                  setEditingId(null)
                  resetForm()
                }}
                disabled={isSaving}
                className="transition-all duration-200 active:scale-95"
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des transactions */}
      <Card className="transition-all duration-300 hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle>Historique des transactions</CardTitle>
          <CardDescription>
            {selectedMonth !== 'tous'
              ? `${moisDisponibles.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
              : `Année ${selectedYear}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="text-right font-semibold">Solde</TableHead>
                  <TableHead>Information</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsFiltreesAvecSolde.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune transaction pour cette période
                    </TableCell>
                  </TableRow>
                ) : (
                  transactionsFiltreesAvecSolde.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {formatDate(transaction.date_operation)}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.debit > 0 && (
                          <span className="text-destructive font-semibold">
                            -{formatMontant(transaction.debit)} €
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.credit > 0 && (
                          <span className="text-[hsl(var(--chart-2))] font-semibold">
                            +{formatMontant(transaction.credit)} €
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold text-lg ${(transaction.solde || 0) >= 0 ? 'text-[hsl(var(--chart-2))]' : 'text-destructive'}`}>
                          {formatMontant(transaction.solde || 0)} €
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {transaction.info_transaction}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(transaction)} className="transition-all duration-200 active:scale-95">
                            Modifier
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(transaction.id)} className="transition-all duration-200 active:scale-95">
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
