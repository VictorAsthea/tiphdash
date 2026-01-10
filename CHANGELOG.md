# Changelog

Toutes les modifications notables de TiphDash sont documentées dans ce fichier.

---

## [0.3.0] - 2026-01-10

### Ajouté
- **Gestion des erreurs** : Affichage visuel des erreurs avec carte rouge et icône AlertCircle
- **États de chargement** : Skeletons animés pendant le chargement initial sur toutes les pages
- **Indicateurs de sauvegarde** : Spinner Loader2 sur les boutons pendant les opérations

### Amélioré
- Try/catch sur toutes les opérations Supabase
- Messages d'erreur explicites et bouton "Fermer" pour les masquer
- Désactivation des boutons pendant la sauvegarde

---

## [0.2.1] - 2026-01-06

### Corrigé
- **Trésorerie** : Report correct du solde de fin d'année sur le début de l'année suivante

---

## [0.2.0] - 2025-12-26

### Amélioré
- **Design ReactBits** : Refonte visuelle sur toutes les pages avec nouveaux styles

---

## [0.1.0] - 2025-12-04

### Ajouté

#### Dashboard
- Affichage des KPIs principaux (Total Mandats, Vendus, En Cours, Potentiels)
- Graphique d'évolution mensuelle du CA (courbe)
- Graphique Objectif vs Réalisé (barres)
- Carte CA Brut avec barre de progression vers l'objectif
- Carte CA Net après URSSAF
- Carte CA Potentiel
- Estimation du salaire mensuel net
- Estimation URSSAF à prévoir (mandats en cours + potentiels)
- Modification de l'objectif annuel

#### Gestion des Mandats
- Liste complète des mandats avec détails extensibles
- Formulaire d'ajout/modification de mandat
- Filtres par statut et typologie
- Barre de recherche (numéro, vendeur, bien, adresse, acquéreur)
- Export CSV des mandats filtrés
- Alertes pour les réitérations à venir (< 7 jours)
- Bouton "Valider vente" pour changer le statut
- Calcul automatique TVA, Commission TTC, URSSAF, Commission Nette
- Taux figés lors de la validation d'une vente

#### Trésorerie
- Liste des transactions avec solde cumulé
- Ajout de transactions (crédit/débit)
- Filtres par année et mois
- Affichage du solde initial, solde de fin, total crédits/débits
- Report automatique du solde entre périodes

#### Analytics
- Taux de conversion (mandats vendus / total)
- CA moyen par mandat vendu
- Graphiques en camembert (répartition par statut et typologie)
- Courbe d'évolution cumulative du CA

#### Configuration
- Modification des taux (TVA, URSSAF + PL)
- Mode sombre avec persistance localStorage
- Toggle de thème dans la navigation

### Corrigé
- Hydratation React pour le mode sombre
- Gestion des champs optionnels dans les formulaires
- Recalcul URSSAF avec taux actuel dans le Dashboard
- Erreurs TypeScript diverses

### Technique
- Next.js 16 avec App Router
- React 19
- Supabase pour la base de données
- Tailwind CSS 4 pour le styling
- shadcn/ui pour les composants
- Recharts pour les graphiques
- react-hook-form + Zod pour les formulaires
- Dynamic imports pour optimiser les performances

---

## [0.0.1] - 2025-12-03

### Ajouté
- Initialisation du projet avec Create Next App
