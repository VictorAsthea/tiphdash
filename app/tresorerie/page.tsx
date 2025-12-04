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
  const [formData, setFormData] = useState({
    date_operation: new Date().toISOString().split('T')[0],
    montant: 0,
    info_transaction: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data, error } = await supabase
      .from('tresorerie')
      .select('*')
      .order('date_operation', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erreur chargement trésorerie:', error)
    } else if (data) {
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
  }

  const handleSave = async () => {
    const transactionData = {
      date_operation: formData.date_operation,
      debit: typeOperation === 'debit' ? formData.montant : 0,
      credit: typeOperation === 'credit' ? formData.montant : 0,
      info_transaction: formData.info_transaction,
    }

    if (editingId) {
      const { error } = await supabase
        .from('tresorerie')
        .update(transactionData)
        .eq('id', editingId)

      if (error) {
        console.error('Erreur mise à jour:', error)
        alert(`Erreur: ${error.message}`)
        return
      }
    } else {
      const { error } = await supabase
        .from('tresorerie')
        .insert([transactionData])

      if (error) {
        console.error('Erreur insertion:', error)
        alert(`Erreur: ${error.message}`)
        return
      }
    }

    setIsAdding(false)
    setEditingId(null)
    resetForm()
    loadData()
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
      await supabase
        .from('tresorerie')
        .delete()
        .eq('id', id)
      loadData()
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

  const soldeActuel = transactions.length > 0 ? transactions[transactions.length - 1].solde || 0 : 0
  const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0)
  const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Trésorerie</h1>
          <p className="text-muted-foreground">Suivi de vos flux financiers</p>
        </div>
        <Button onClick={() => setIsAdding(true)} size="lg">
          + Nouvelle transaction
        </Button>
      </div>

      {/* Indicateurs principaux */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription>Solde Actuel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${soldeActuel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {soldeActuel >= 0 ? '+' : ''}{formatMontant(soldeActuel)} €
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Crédits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              +{formatMontant(totalCredits)} €
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Débits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              -{formatMontant(totalDebits)} €
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire d'ajout */}
      {isAdding && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>{editingId ? 'Modifier' : 'Ajouter'} une transaction</CardTitle>
            <CardDescription>Enregistrez une opération de trésorerie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type_operation">Type d&apos;opération</Label>
                <Select value={typeOperation} onValueChange={(value: any) => setTypeOperation(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">
                      <span className="text-green-600 font-medium">Crédit (Entrée d&apos;argent)</span>
                    </SelectItem>
                    <SelectItem value="debit">
                      <span className="text-red-600 font-medium">Débit (Sortie d&apos;argent)</span>
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
              <Button onClick={handleSave} size="lg">
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false)
                  setEditingId(null)
                  resetForm()
                }}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des transactions</CardTitle>
          <CardDescription>{transactions.length} transaction{transactions.length > 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
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
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune transaction pour le moment
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {formatDate(transaction.date_operation)}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.debit > 0 && (
                          <span className="text-red-600 font-semibold">
                            -{formatMontant(transaction.debit)} €
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.credit > 0 && (
                          <span className="text-green-600 font-semibold">
                            +{formatMontant(transaction.credit)} €
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold text-lg ${(transaction.solde || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMontant(transaction.solde || 0)} €
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {transaction.info_transaction}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(transaction)}>
                            Modifier
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(transaction.id)}>
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
