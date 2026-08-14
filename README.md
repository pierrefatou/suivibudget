# Mon budget — Suivi des dépenses

Application React de suivi des dépenses mensuelles : catégorisation, budgets par
catégorie, suivi des revenus, check-up d'épargne et statistiques.

Les données sont stockées dans **Supabase**, sans authentification. L'app
génère une **clé de synchronisation** aléatoire (visible et copiable dans
l'interface) : colle-la sur un autre appareil pour retrouver les mêmes données.

## ⚠️ À savoir sur la sécurité

Comme il n'y a pas de compte utilisateur, la policy Supabase autorise
n'importe qui possédant ta clé publique "anon" à lire/écrire **toutes** les
lignes de la table, quelle que soit la clé de synchronisation. Cette clé ne
protège que par obscurité (comme un lien secret) — elle n'est pas vérifiée
par la base de données elle-même. Ne l'utilise pas pour des données
sensibles, et ne partage pas ta clé de synchronisation publiquement.

## 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) et crée un nouveau projet
   (gratuit).
2. Une fois le projet prêt, ouvre **SQL Editor** dans le menu de gauche.
3. Colle le contenu du fichier `supabase-setup.sql` (à la racine de ce
   projet) et clique sur **Run**. Cela crée la table `kv_store` et sa policy
   d'accès.
4. Va dans **Project Settings > API**. Récupère :
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2. Installation locale

Prérequis : [Node.js](https://nodejs.org/) (version 18 ou plus).

```bash
npm install
cp .env.example .env
```

Ouvre `.env` et colle tes deux valeurs Supabase.

## 3. Développement local

```bash
npm run dev
```

Ouvre l'adresse affichée dans le terminal (en général `http://localhost:5173`).

## 4. Avant de déployer : configure le bon chemin

Ouvre `vite.config.js` et vérifie la ligne `base`. Elle doit correspondre au
nom de ton dépôt GitHub :

- Dépôt nommé `suivi-depenses` → `base: "/suivi-depenses/"`
- Dépôt nommé `<ton-pseudo>.github.io` (site personnel principal) → `base: "/"`

## 5. Déployer sur GitHub Pages

### Option A — Déploiement automatique (recommandé)

Un workflow GitHub Actions est déjà inclus (`.github/workflows/deploy.yml`) :
à chaque `push` sur `main`, le site est reconstruit et publié tout seul.

1. Crée un dépôt sur GitHub et pousse ce projet dedans :
   ```bash
   git init
   git add .
   git commit -m "Premier commit"
   git branch -M main
   git remote add origin https://github.com/<ton-pseudo>/<nom-du-depot>.git
   git push -u origin main
   ```
2. Dans le dépôt, va dans **Settings → Secrets and variables → Actions →
   New repository secret**, et ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (mêmes valeurs que dans ton `.env` local — le build en a besoin pour
   fonctionner une fois déployé).
3. Va dans **Settings → Pages**. Dans **Build and deployment → Source**,
   choisis **GitHub Actions**.
4. Attends la fin du workflow (onglet **Actions**) — le site sera ensuite
   disponible à `https://<ton-pseudo>.github.io/<nom-du-depot>/`.

Les mises à jour suivantes : un simple `git push` sur `main` redéploie tout
automatiquement.

### Option B — Déploiement manuel

```bash
npm run build
npm run deploy
```

`npm run deploy` publie le contenu de `dist/` sur une branche `gh-pages` via
le paquet `gh-pages`. Choisis ensuite cette branche comme source dans
**Settings → Pages**.

## Retrouver tes données sur un autre appareil

Dans l'app, en haut de la page, un bandeau affiche ta **clé de
synchronisation**. Clique sur **Copier**, puis sur ton autre appareil clique
sur **Utiliser une autre clé** et colle-la : tu retrouveras les mêmes
dépenses, revenus et budgets.

## Structure du projet

```
suivi-depenses/
├── supabase-setup.sql       # script SQL à exécuter dans Supabase
├── .env.example              # modèle pour tes clés Supabase
├── index.html
├── vite.config.js            # base path pour GitHub Pages
├── tailwind.config.js
├── src/
│   ├── main.jsx               # point d'entrée React
│   ├── App.jsx                 # l'application (composant principal)
│   ├── supabaseClient.js       # client Supabase
│   ├── storage.js              # persistance + clé de synchronisation
│   └── index.css
└── .github/workflows/deploy.yml   # déploiement automatique
```
