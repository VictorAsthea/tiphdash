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

type Mandat = {
  id: string
  statut: 'en_cours' | 'vendu' | 'annule' | 'potentiel'
  numero_mandat: string
  typologie: 'exclusif' | 'semi_exclusif' | 'co_exclusif' | 'simple'
  vendeur: string
  date_signature: string
  bien: string
  adresse: string
  acquireur: string | null
  date_compromis: string | null
  date_reiteration_prevue: string | null
  honoraires_agence_ht: number
  honoraires_moi_ht: number
  tva: number
  commission_ttc: number
  urssaf: number
  commission_nette: number
  taux_tva_fige: number | null
  taux_urssaf_fige: number | null
}

type Config = {
  key: string
  value: number
}

export default function MandatsPage() {
  const [mandats, setMandats] = useState<Mandat[]>([])
  const [expandedMandatId, setExpandedMandatId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // États pour la recherche et les filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [filterTypologie, setFilterTypologie] = useState<string>('tous')
  const [formData, setFormData] = useState<{
    statut: 'en_cours' | 'vendu' | 'annule' | 'potentiel'
    numero_mandat: string
    typologie: 'exclusif' | 'semi_exclusif' | 'co_exclusif' | 'simple'
    vendeur: string
    date_signature: string
    bien: string
    adresse: string
    acquireur: string
    date_compromis: string
    date_reiteration_prevue: string
    honoraires_agence_ht: number
    honoraires_moi_ht: number
  }>({
    statut: 'en_cours',
    numero_mandat: '',
    typologie: 'exclusif',
    vendeur: '',
    date_signature: '',
    bien: '',
    adresse: '',
    acquireur: '',
    date_compromis: '',
    date_reiteration_prevue: '',
    honoraires_agence_ht: 0,
    honoraires_moi_ht: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: mandatsData, error } = await supabase
      .from('mandats')
      .select('*')
      .order('date_signature', { ascending: false })

    if (error) {
      console.error('Erreur chargement mandats:', error)
      return
    }

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

      const tauxTVA = config['taux_tva'] || 20
      const tauxURSSAF = config['taux_urssaf_pl'] || 26.8

      // Recalculer les commissions pour les mandats en_cours et potentiel
      const mandatsRecalcules = mandatsData.map(mandat => {
        // Si le mandat est vendu, utiliser les taux figés
        if (mandat.statut === 'vendu' && mandat.taux_tva_fige && mandat.taux_urssaf_fige) {
          return mandat
        }

        // Sinon, recalculer avec les taux actuels
        const tva = mandat.honoraires_moi_ht * (tauxTVA / 100)
        const commissionTTC = mandat.honoraires_moi_ht + tva
        const urssaf = mandat.honoraires_moi_ht * (tauxURSSAF / 100)
        const commissionNette = mandat.honoraires_moi_ht - urssaf

        return {
          ...mandat,
          tva,
          commission_ttc: commissionTTC,
          urssaf,
          commission_nette: commissionNette,
        }
      })

      setMandats(mandatsRecalcules)
    }
  }

  const calculateCommissions = async (honorairesMoiHt: number, statut: string) => {
    // Recharger la config AVANT chaque calcul pour avoir les taux à jour
    const { data: configData } = await supabase
      .from('config')
      .select('key, value')

    const config: Record<string, number> = {}
    if (configData) {
      configData.forEach(item => {
        config[item.key] = item.value
      })
    }

    const tauxTVA = config['taux_tva'] || 20
    const tauxURSSAF = config['taux_urssaf_pl'] || 26.8

    const tva = honorairesMoiHt * (tauxTVA / 100)
    const commissionTTC = honorairesMoiHt + tva
    const urssaf = honorairesMoiHt * (tauxURSSAF / 100)
    const commissionNette = honorairesMoiHt - urssaf

    return {
      tva,
      commission_ttc: commissionTTC,
      urssaf,
      commission_nette: commissionNette,
      // Figer les taux uniquement si le statut est "vendu"
      taux_tva_fige: statut === 'vendu' ? tauxTVA : null,
      taux_urssaf_fige: statut === 'vendu' ? tauxURSSAF : null,
    }
  }

  const handleSave = async () => {
    const commissions = await calculateCommissions(formData.honoraires_moi_ht, formData.statut)

    const mandatData = {
      ...formData,
      ...commissions,
      acquireur: formData.acquireur || null,
      date_compromis: formData.date_compromis || null,
      date_reiteration_prevue: formData.date_reiteration_prevue || null,
    }

    if (editingId) {
      const { error } = await supabase
        .from('mandats')
        .update(mandatData)
        .eq('id', editingId)

      if (error) {
        console.error('Erreur mise à jour:', error)
        alert(`Erreur: ${error.message}`)
        return
      }
    } else {
      const { error } = await supabase
        .from('mandats')
        .insert([mandatData])

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

  const handleEdit = (mandat: Mandat) => {
    setFormData({
      statut: mandat.statut,
      numero_mandat: mandat.numero_mandat,
      typologie: mandat.typologie,
      vendeur: mandat.vendeur,
      date_signature: mandat.date_signature,
      bien: mandat.bien,
      adresse: mandat.adresse,
      acquireur: mandat.acquireur || '',
      date_compromis: mandat.date_compromis || '',
      date_reiteration_prevue: mandat.date_reiteration_prevue || '',
      honoraires_agence_ht: mandat.honoraires_agence_ht,
      honoraires_moi_ht: mandat.honoraires_moi_ht,
    })
    setEditingId(mandat.id)
    setIsAdding(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce mandat ?')) {
      await supabase
        .from('mandats')
        .delete()
        .eq('id', id)
      loadData()
    }
  }

  const handleValiderVente = async (mandat: Mandat) => {
    if (confirm('Valider la vente de ce mandat ?')) {
      await supabase
        .from('mandats')
        .update({ statut: 'vendu' })
        .eq('id', mandat.id)
      loadData()
    }
  }

  const toggleExpand = (mandatId: string) => {
    setExpandedMandatId(expandedMandatId === mandatId ? null : mandatId)
  }

  // Filtrer les mandats en fonction de la recherche et des filtres
  const mandatsFilteres = mandats.filter(mandat => {
    // Filtre de recherche
    const matchSearch = searchTerm === '' ||
      mandat.numero_mandat.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mandat.vendeur.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mandat.bien.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mandat.adresse.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (mandat.acquireur && mandat.acquireur.toLowerCase().includes(searchTerm.toLowerCase()))

    // Filtre de statut
    const matchStatut = filterStatut === 'tous' || mandat.statut === filterStatut

    // Filtre de typologie
    const matchTypologie = filterTypologie === 'tous' || mandat.typologie === filterTypologie

    return matchSearch && matchStatut && matchTypologie
  })

  const resetForm = () => {
    setFormData({
      statut: 'en_cours',
      numero_mandat: '',
      typologie: 'exclusif',
      vendeur: '',
      date_signature: '',
      bien: '',
      adresse: '',
      acquireur: '',
      date_compromis: '',
      date_reiteration_prevue: '',
      honoraires_agence_ht: 0,
      honoraires_moi_ht: 0,
    })
  }

  const getStatutBadgeClass = (statut: string) => {
    switch (statut) {
      case 'vendu':
        return 'bg-green-100 text-green-800'
      case 'en_cours':
        return 'bg-blue-100 text-blue-800'
      case 'potentiel':
        return 'bg-yellow-100 text-yellow-800'
      case 'annule':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'en_cours':
        return 'En cours'
      case 'vendu':
        return 'Vendu'
      case 'annule':
        return 'Annulé'
      case 'potentiel':
        return 'Potentiel'
      default:
        return statut
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR')
  }

  // Vérifier si la date de réitération est proche (moins de 7 jours)
  const isDateReitProche = (dateReiteration: string | null) => {
    if (!dateReiteration) return false
    const date = new Date(dateReiteration)
    const aujourd'hui = new Date()
    const diffJours = Math.ceil((date.getTime() - aujourd'hui.getTime()) / (1000 * 60 * 60 * 24))
    return diffJours >= 0 && diffJours <= 7
  }

  // Compter les alertes
  const alertesReiteration = mandats.filter(m =>
    m.statut === 'en_cours' && isDateReitProche(m.date_reiteration_prevue)
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Gestion des Mandats</h1>
          <p className="text-muted-foreground">Liste de tous vos mandats</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>Ajouter un mandat</Button>
      </div>

      {/* Alertes */}
      {alertesReiteration.length > 0 && (
        <Card className="border-l-4 border-l-orange-500 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-orange-600 text-xl">⚠️</div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">
                  {alertesReiteration.length} réitération{alertesReiteration.length > 1 ? 's' : ''} à venir dans les 7 prochains jours
                </h3>
                <div className="space-y-1">
                  {alertesReiteration.map(mandat => (
                    <div key={mandat.id} className="text-sm text-orange-800">
                      <strong>{mandat.numero_mandat}</strong> - {mandat.bien} - {formatDate(mandat.date_reiteration_prevue)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barre de recherche et filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="search">Rechercher</Label>
              <Input
                id="search"
                placeholder="N° mandat, vendeur, bien, adresse, acquéreur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-statut">Statut</Label>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger id="filter-statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="vendu">Vendu</SelectItem>
                  <SelectItem value="potentiel">Potentiel</SelectItem>
                  <SelectItem value="annule">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-typologie">Typologie</Label>
              <Select value={filterTypologie} onValueChange={setFilterTypologie}>
                <SelectTrigger id="filter-typologie">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="exclusif">Exclusif</SelectItem>
                  <SelectItem value="semi_exclusif">Semi-exclusif</SelectItem>
                  <SelectItem value="co_exclusif">Co-exclusif</SelectItem>
                  <SelectItem value="simple">Simple</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            {mandatsFilteres.length} mandat{mandatsFilteres.length > 1 ? 's' : ''} trouvé{mandatsFilteres.length > 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Modifier' : 'Ajouter'} un mandat</CardTitle>
            <CardDescription>Remplissez les informations du mandat</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="statut">Statut</Label>
                <Select value={formData.statut} onValueChange={(value: any) => setFormData({ ...formData, statut: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="vendu">Vendu</SelectItem>
                    <SelectItem value="annule">Annulé</SelectItem>
                    <SelectItem value="potentiel">Potentiel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero_mandat">N° Mandat</Label>
                <Input
                  id="numero_mandat"
                  value={formData.numero_mandat}
                  onChange={(e) => setFormData({ ...formData, numero_mandat: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="typologie">Typologie</Label>
                <Select value={formData.typologie} onValueChange={(value: any) => setFormData({ ...formData, typologie: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exclusif">Exclusif</SelectItem>
                    <SelectItem value="semi_exclusif">Semi Exclusif</SelectItem>
                    <SelectItem value="co_exclusif">Co Exclusif</SelectItem>
                    <SelectItem value="simple">Simple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendeur">Vendeur</Label>
                <Input
                  id="vendeur"
                  value={formData.vendeur}
                  onChange={(e) => setFormData({ ...formData, vendeur: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_signature">Date de signature</Label>
                <Input
                  id="date_signature"
                  type="date"
                  value={formData.date_signature}
                  onChange={(e) => setFormData({ ...formData, date_signature: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bien">Bien</Label>
                <Input
                  id="bien"
                  value={formData.bien}
                  onChange={(e) => setFormData({ ...formData, bien: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="adresse">Adresse du bien</Label>
                <Input
                  id="adresse"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acquireur">Acquéreur</Label>
                <Input
                  id="acquireur"
                  value={formData.acquireur}
                  onChange={(e) => setFormData({ ...formData, acquireur: e.target.value })}
                  placeholder="À renseigner plus tard"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_compromis">Date de compromis</Label>
                <Input
                  id="date_compromis"
                  type="date"
                  value={formData.date_compromis}
                  onChange={(e) => setFormData({ ...formData, date_compromis: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_reiteration_prevue">Date de réitération prévue</Label>
                <Input
                  id="date_reiteration_prevue"
                  type="date"
                  value={formData.date_reiteration_prevue}
                  onChange={(e) => setFormData({ ...formData, date_reiteration_prevue: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="honoraires_agence_ht">Honoraires Agence HT</Label>
                <Input
                  id="honoraires_agence_ht"
                  type="number"
                  step="0.01"
                  value={formData.honoraires_agence_ht}
                  onChange={(e) => setFormData({ ...formData, honoraires_agence_ht: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="honoraires_moi_ht">Honoraires pour moi HT</Label>
                <Input
                  id="honoraires_moi_ht"
                  type="number"
                  step="0.01"
                  value={formData.honoraires_moi_ht}
                  onChange={(e) => setFormData({ ...formData, honoraires_moi_ht: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleSave}>Enregistrer</Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Liste des mandats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statut</TableHead>
                  <TableHead>N° Mandat</TableHead>
                  <TableHead>Typologie</TableHead>
                  <TableHead>Vendeur</TableHead>
                  <TableHead>Bien</TableHead>
                  <TableHead>Honoraires HT</TableHead>
                  <TableHead>Commission Nette</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Aucun mandat pour le moment
                    </TableCell>
                  </TableRow>
                ) : (
                  mandatsFilteres.map((mandat) => (
                    <>
                      <TableRow
                        key={mandat.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(mandat.id)}
                      >
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatutBadgeClass(mandat.statut)}`}>
                              {getStatutLabel(mandat.statut)}
                            </span>
                            {isDateReitProche(mandat.date_reiteration_prevue) && (
                              <span className="text-orange-600 text-sm" title="Réitération dans moins de 7 jours">
                                ⚠️
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{mandat.numero_mandat}</TableCell>
                        <TableCell>{mandat.typologie}</TableCell>
                        <TableCell>{mandat.vendeur}</TableCell>
                        <TableCell>{mandat.bien}</TableCell>
                        <TableCell>{mandat.honoraires_moi_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</TableCell>
                        <TableCell className="font-semibold">{mandat.commission_nette.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            {mandat.statut !== 'vendu' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleValiderVente(mandat)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Valider vente
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handleEdit(mandat)}>
                              Modifier
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(mandat.id)}>
                              Supprimer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedMandatId === mandat.id && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                <div>
                                  <div className="text-xs text-muted-foreground">Adresse</div>
                                  <div className="font-medium">{mandat.adresse}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Date de signature</div>
                                  <div className="font-medium">{formatDate(mandat.date_signature)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Acquéreur</div>
                                  <div className="font-medium">{mandat.acquireur || '-'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Date de compromis</div>
                                  <div className="font-medium">{formatDate(mandat.date_compromis)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Date de réitération prévue</div>
                                  <div className="font-medium">{formatDate(mandat.date_reiteration_prevue)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Honoraires Agence HT</div>
                                  <div className="font-medium">{mandat.honoraires_agence_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">TVA (20%)</div>
                                  <div className="font-medium">{mandat.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Commission TTC</div>
                                  <div className="font-medium">{mandat.commission_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Urssaf</div>
                                  <div className="font-medium">{mandat.urssaf.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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
