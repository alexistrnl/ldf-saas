# Configuration Admin - Sécurisation avec RLS

## Vue d'ensemble

L'administration est maintenant sécurisée avec **Row Level Security (RLS)** basée sur `profiles.is_admin`. Seuls les utilisateurs avec `profiles.is_admin = true` peuvent accéder aux fonctionnalités admin.

## Installation

### 1. Exécuter la migration SQL

Dans Supabase Dashboard > SQL Editor, exécutez la migration :

```sql
-- Fichier: database/migrations/20250115000008_secure_admin_with_rls.sql
```

Cette migration :
- ✅ Crée une fonction `is_admin_user()` qui vérifie `profiles.is_admin`
- ✅ Applique RLS sur toutes les tables admin (restaurants, dishes, brand_suggestions, profiles, fastfood_logs)
- ✅ Empêche la modification de `is_admin` sauf par les admins
- ✅ Autorise uniquement les admins à gérer les données admin

### 2. Définir votre utilisateur comme admin

#### Option A : Via Supabase Dashboard (recommandé)

1. Connectez-vous à votre application
2. Ouvrez la console du navigateur (F12)
3. Exécutez cette commande pour obtenir votre `user_id` :
   ```javascript
   (await supabase.auth.getUser()).data.user.id
   ```
4. Dans Supabase Dashboard > SQL Editor, exécutez :
   ```sql
   UPDATE public.profiles 
   SET is_admin = true 
   WHERE id = '<votre_user_id>';
   ```

#### Option B : Via Supabase Dashboard > Authentication

1. Allez dans Supabase Dashboard > Authentication > Users
2. Trouvez votre utilisateur et copiez l'ID
3. Dans SQL Editor, exécutez :
   ```sql
   UPDATE public.profiles 
   SET is_admin = true 
   WHERE id = '<user_id_copié>';
   ```

### 3. Vérifier que vous êtes admin

Dans Supabase SQL Editor :

```sql
SELECT id, email, is_admin 
FROM public.profiles 
WHERE id = '<votre_user_id>';
```

Vous devriez voir `is_admin = true`.

## Sécurité

### Protection RLS

Les policies RLS garantissent que :

1. **Seuls les admins peuvent** :
   - Lire/modifier/supprimer les restaurants
   - Lire/modifier/supprimer les plats (dishes)
   - Lire/modifier toutes les suggestions de marques
   - Modifier `is_verified` et `is_admin` dans profiles
   - Lire tous les logs utilisateurs

2. **Les utilisateurs normaux peuvent** :
   - Lire les restaurants et plats (pour l'app)
   - Créer leurs propres suggestions de marques
   - Modifier leur propre profil (sauf `is_admin` et `is_verified`)
   - Gérer leurs propres logs

3. **Protection contre l'auto-promotion** :
   - Un trigger empêche les utilisateurs de modifier leur propre `is_admin`
   - Seuls les admins peuvent modifier `is_admin`

### Middleware

Le middleware (`middleware.ts`) vérifie automatiquement `profiles.is_admin` avant d'autoriser l'accès à `/admin/*`.

## Tables protégées

- ✅ `profiles` - Gestion des utilisateurs
- ✅ `restaurants` - Gestion des enseignes
- ✅ `dishes` - Gestion des plats
- ✅ `brand_suggestions` - Suggestions d'enseignes
- ✅ `fastfood_logs` - Logs utilisateurs

## Fonctionnement

### Frontend

- Le middleware vérifie `profiles.is_admin` avant d'autoriser l'accès à `/admin/*`
- Si l'utilisateur n'est pas admin, redirection vers `/`
- Si l'utilisateur n'est pas connecté, redirection vers `/login?next=/admin/...`

### Backend (RLS)

- Même si quelqu'un contourne le frontend, RLS bloque l'accès aux données
- Les policies vérifient `is_admin_user()` qui lit `profiles.is_admin`
- Impossible de modifier `is_admin` sans être déjà admin

## Dépannage

### Je ne peux plus accéder à /admin

1. Vérifiez que `is_admin = true` dans votre profil :
   ```sql
   SELECT id, is_admin FROM public.profiles WHERE id = '<votre_user_id>';
   ```

2. Si `is_admin` est `false` ou `NULL`, mettez-le à `true` :
   ```sql
   UPDATE public.profiles SET is_admin = true WHERE id = '<votre_user_id>';
   ```

### Erreur "permission denied" sur les tables admin

Cela signifie que RLS fonctionne correctement ! Vérifiez que :
1. La migration a été exécutée
2. Votre utilisateur a `is_admin = true`
3. Vous êtes bien connecté

### Ajouter un autre admin

```sql
UPDATE public.profiles 
SET is_admin = true 
WHERE id = '<user_id_du_nouvel_admin>';
```

### Retirer les droits admin

```sql
UPDATE public.profiles 
SET is_admin = false 
WHERE id = '<user_id>';
```

## Notes importantes

- ⚠️ **Ne supprimez jamais tous les admins** - vous ne pourriez plus en créer de nouveaux !
- ⚠️ **Gardez au moins un admin** à tout moment
- ✅ Le mot de passe UI (si vous en avez un) ne donne aucun droit sans `is_admin = true` en DB
- ✅ RLS protège même si quelqu'un contourne le frontend
