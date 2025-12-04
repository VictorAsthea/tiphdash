import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      projections_ca: {
        Row: {
          id: string
          year: number
          objectif: number
          benefice_net: number
          impot_annuel: number
          salaire_mensuel_net: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projections_ca']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projections_ca']['Insert']>
      }
      mandats: {
        Row: {
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
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['mandats']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['mandats']['Insert']>
      }
      config: {
        Row: {
          id: string
          key: string
          value: number
          label: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['config']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['config']['Insert']>
      }
    }
  }
}
