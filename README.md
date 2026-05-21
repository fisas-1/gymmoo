# Gymmoo 💪

Sistema de gestió d'entrenaments i rutines amb Next.js i Supabase.

## Setup Inicial ⚠️

**IMPORTANT**: Abans d'arrancar l'aplicació, cal configurar la base de dades:

### 1. Configurar Supabase

L'aplicació usa Supabase amb les següents variables d'entorn (ja configurades a `.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`: https://ronzmensezcuszabqfbz.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: *(ja configurat)*

### 2. Configurar Base de Dades

L'aplicació requereix columnes i taules addicionals a la base de dades. 

**Cal executar l'SQL al Supabase Dashboard:**
1. Obre: https://ronzmensezcuszabqfbz.supabase.co
2. Ves a **SQL Editor** (icona de base de dades)
3. Clica **New query**
4. Copia el contingut de `deploy-schema.sql`
5. Clica **Run** (Ctrl+Enter)

Veure `SOLUZIONE.md` o `FIX_DATABASE.md` per més detalls.

### 3. Arrancar el Desenvolupament

```bash
npm run dev
```

Obrir [http://localhost:3000](http://localhost:3000) amb el navegador.

---

## Funcionalitats 🚀

### Pàgina Principal (/)
- Registra entrenaments (pes, reps, RIR)
- Càlcul automàtic de 1RM
- Recomanacions de pes segons l'historial
- Gràfics de progressió

### Rutines (/rutines)
- Crea i gestiona rutines personals
- Afegir exercicis amb objectius de sèries/reps
- Marcar sèries com a completades
- Recomanació de pes per a cada exercici
- Reset diari per a nova sessió

---

## Estructura del Projecte

```
gymmoo/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Pàgina principal (entrenaments)
│   ├── rutines/page.tsx     # Gestor de rutines
│   ├── contexts/            # Context d'autenticació
│   └── lib/supabase/        # Configuració Supabase
├── supabase/                # Migracions SQL
│   └── migrations/
│       ├── 20250424_add_routines_schema.sql
│       └── FIX_add_exercise_columns.sql
├── types/                   # Tipus TypeScript
│   └── index.ts
├── deploy-schema.sql        # SQL complet per deploy
└── verify-fix.js            # Script de verificació
```

---

## Scripts Disponibles

```bash
# Desenvolupament
npm run dev          # Arranca el servidor (localhost:3000)

# Verificació
node verify-fix.js   # Comprova l'estat de la base de dades
node check-schema.js # Comprova columnes de workout_logs

# Deploy
# Executar deploy-schema.sql a Supabase SQL Editor
```

---

## Base de Dades (Supabase)

### Taules Principals

#### `workout_logs` - Registre d'entrenaments
- `exercise` (TEXT) - Nom de l'exercici
- `weight` (NUMERIC) - Pes sollevat
- `reps` (INTEGER) - Repeticions
- `rir` (NUMERIC) - Repeticions en reserva
- `one_rm` (NUMERIC) - 1RM calculat

#### `routines` - Rutines d'entrenament
- `name` (TEXT) - Nom de la rutina
- `user_id` (UUID) - Propietari

#### `routine_exercises` - Exercicis de cada rutina
- `routine_id` (UUID) - Rutina pare
- `exercise` (TEXT) - Nom exercici
- `sets_target` (INTEGER) - Series objectiu
- `reps_min/max` (INTEGER) - Rang de reps

#### `routine_sets` - Series completades
- `routine_exercise_id` (UUID) - Exercici
- `set_number` (INTEGER) - Número de sèrie
- `completed` (BOOLEAN) - Completada?

### Funcions

#### `get_weight_recommendation()`
Retorna la recomanació de pes per a un exercici i nombre de reps objectiu, basat en l'historial de l'usuari.

---

## Troubleshooting 🔧

### Error: "Could not find the 'exercise' column"
**Solució**: Executar l'SQL a Supabase (veure pas 2 del Setup)

### Error: "Could not find the table 'routines'"
**Solució**: L'SQL de les taules no s'ha executat. Copiar `deploy-schema.sql` a Supabase.

### Error de CORS o API
**Solució**: Verificar que les variables d'entorn a `.env.local` són correctes.

---

## Seguretat

- **Row Level Security (RLS)** habilitat a totes les taules
- Cada usuari només pot accedir a les seves pròpies dades
- Policies d'accés per a SELECT, INSERT, UPDATE, DELETE

---

## Documentació

- `SOLUZIONE.md` - Guia de resolució (italià)
- `FIX_DATABASE.md` - Documentació detallada (anglès)
- `RUTINES_INSTALACIO.md` - Instruccions d'instal·lació (català)

---

## Tècnologies

- **Next.js** - Framework React
- **TypeScript** - Tipatge estricte
- **Supabase** - Base de dades i autenticació
- **Tailwind CSS** - Estils

---

*Desenvolupat amb ❤️ per Gymmoo*
