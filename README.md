# FarimaGame — plateforme de jeux (Ludo, Dames, Awalé, Échecs)

Application Next.js 16 (App Router, React 19, Tailwind CSS v4, TypeScript) qui tourne **entièrement en local**,
sans base de données externe.

## Lancer le projet

```bash
cd ~/Desktop/farimagame-local
npm install        # une seule fois (déjà fait)
npm run dev        # http://localhost:3000
```

Version de production :

```bash
npm run build
npm start          # http://localhost:3000
```

Pour jouer à plusieurs depuis d'autres appareils du même réseau Wi-Fi : `npm run dev -- -H 0.0.0.0`
puis ouvrez `http://<adresse-ip-du-mac>:3000` sur les autres appareils.

## Connexion et inscription (Clerk)

Les comptes, mots de passe et sessions sont gérés par [Clerk](https://clerk.com) (pages `/connexion` et `/inscription`,
en français, aux couleurs de FarimaGame ; menu « Mon compte et sécurité » et déconnexion dans la barre du haut).

- **Sans clés (développement)** : `npm run dev` fonctionne tout de suite. Clerk crée une application de test temporaire
  (« keyless mode ») dont les clés sont rangées dans `.clerk/` (ignoré par git). Le terminal affiche un lien
  `https://dashboard.clerk.com/apps/claim?...` : ouvrez-le et connectez-vous à Clerk pour **récupérer cette application**
  (sinon elle expire et les comptes de test sont perdus).
- **Avec vos clés** : sur https://dashboard.clerk.com → votre application → *API keys*, copiez les deux clés dans
  `.env.local` puis relancez le serveur :
  ```
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
  CLERK_SECRET_KEY=sk_test_...
  ADMIN_EMAILS=vous@exemple.com
  ```
  Ces clés sont **obligatoires en production** (`npm run build` + `npm start`) : sans elles, la connexion est désactivée.
- **Fiche joueur** : à la première visite d'un compte Clerk connecté, FarimaGame crée automatiquement sa fiche dans
  `data/db.json` (rôle JOUEUR, **500 Coris** de bienvenue, pseudo tiré du pseudo Clerk, sinon du prénom, sinon du début
  de l'e-mail, rendu unique : gerard, gerard2…), reliée au compte par `clerkId`. Portefeuilles et parties ne changent pas.
- **Anciens comptes à mot de passe** : conservés dans la base (soldes et historique), mais ils ne peuvent plus se connecter.
- Pages réservées (`/tableau-de-bord`, `/portefeuille`, `/passer-pro`, `/pro`, `/salon`, `/jeu`, `/maison`, `/admin`) :
  un visiteur est redirigé vers `/connexion` par `proxy.ts` ; les API renvoient 401 / 403.

## Pages

| Page | Adresse |
| --- | --- |
| Accueil | `/` |
| Inscription / Connexion | `/inscription`, `/connexion` |
| Tableau de bord (soldes, statistiques, historique) | `/tableau-de-bord` |
| Salon de jeu (lobby) | `/salon` |
| Partie | `/jeu/<id>` |
| Niveau Pro & conversion Coris → Lions | `/pro`, `/passer-pro` |
| Portefeuille F CFA (dépôt, retrait, conversion Lions → F CFA, historique) | `/portefeuille` |
| Comptes utilisateurs (**ADMIN**) | `/admin` |
| La Maison – commissions, caisse, validation des retraits (**Maison**) | `/maison` |

## Règles de l'argent virtuel

Tous les paramètres sont dans `lib/config.ts`.

- Chaque utilisateur a le rôle **JOUEUR**. À l'inscription il reçoit **500 Coris**.
- **Niveau normal** : une partie coûte **50 Coris** (mise débitée dès qu'on crée ou rejoint une table).
- Modes : **contre l'ordinateur**, ou **2, 3 ou 4 joueurs** selon le jeu
  (Ludo : ordinateur / 2 / 3 / 4 ; Dames, Awalé, Échecs : ordinateur / 2 joueurs).
- La partie démarre quand la table est complète. Le **gagnant reçoit 80 % du pot** (somme des mises),
  la **maison garde 20 %**.
- **Niveau Pro** : le joueur peut passer Pro (gratuit) depuis la page `/pro`, puis convertir ses Coris en
  Lions au taux **50 Coris = 1 Lion**. Il peut alors jouer en Lions, avec les mêmes modes et la même règle 80 / 20.
- Toute la logique d'argent est côté serveur (vérification des soldes, du tour de jeu, des coups).
  Chaque mouvement est inscrit dans un **historique des transactions** (bonus, mise, gain, nul,
  remboursement, conversion). La caisse de la maison a son propre journal.

### Hypothèses retenues (modifiables)

1. **Contre l'ordinateur**, l'ordinateur mise le même montant que le joueur (avancé par la maison) :
   le pot vaut donc 2 × la mise. Gagner rapporte 80 Coris (100 × 80 %) pour 50 Coris misés.
   Si l'ordinateur gagne, sa part (80 %) revient à la maison, en plus des 20 % de commission.
2. **Mise Pro** : **1 Lion** par défaut (`PRO_STAKE_LIONS` dans `lib/config.ts`, ou variable d'environnement
   `PRO_STAKE_LIONS=2 npm run dev`). Les montants en Lions peuvent avoir des décimales (ex. 80 % de 2 Lions = 1,6 Lion).
3. **Match nul** (Échecs, Dames, Awalé) : la maison prend toujours 20 %, les 80 % restants sont partagés
   à parts égales entre les joueurs.
4. **Abandon** : le joueur qui abandonne perd sa mise. À 2 joueurs, l'adversaire gagne ; au Ludo à 3-4,
   la partie continue sans lui jusqu'à ce qu'il ne reste qu'un joueur ou qu'un joueur gagne.
5. **Inactivité** : si un adversaire humain ne joue pas pendant 2 minutes, les autres joueurs peuvent
   « réclamer la victoire » (il est déclaré forfait).
6. Quitter une table **avant le début** de la partie rembourse la mise.
7. La conversion porte sur n'importe quels Coris du solde (y compris le bonus), par nombre entier de Lions.
   Un joueur Pro peut continuer à jouer en Coris.
8. Les Coris et les Lions restent une monnaie virtuelle de jeu. Le F CFA sert aux dépôts, aux retraits et à l'achat de Lions ;
   dans cette version, **tous les paiements sont simulés**.

## Rôles

- **JOUEUR** : rôle par défaut.
- **ADMIN** : accès à `/admin` (comptes, invitations) et, avec le rôle Maison, à `/maison`.
  - Recommandé : `ADMIN_EMAILS=vous@exemple.com,associe@exemple.com` dans `.env.local` (e-mails des comptes Clerk).
    On peut aussi utiliser `ADMIN_USERNAMES` (pseudos FarimaGame). Si l'une de ces variables est définie, **seuls** ces comptes sont ADMIN.
  - Sinon, le **premier compte Clerk** qui se connecte devient ADMIN s'il n'existe encore aucun administrateur relié à Clerk
    (l'ancien admin à mot de passe ne compte pas, puisqu'il ne peut plus se connecter).

## Portefeuille F CFA (XOF)

Troisième solde, en **francs CFA entiers**. Deux façons de l'alimenter :

1. **Convertir des Lions en F CFA** (joueurs **Pro** uniquement, par Lion entier) au taux `FCFA_PER_LION`
   (**500 F CFA par Lion par défaut — HYPOTHÈSE à fixer par vous**).
   Chaîne complète : 50 Coris → 1 Lion → 500 F CFA.
2. **Dépôt Mobile Money** : Orange Money, MTN MoMo, Wave ou Moov Money, numéro ivoirien à 10 chiffres.
   **Mode démo / simulation** : aucun argent réel ne circule, le dépôt est crédité immédiatement
   (un numéro finissant par `0000` simule un refus de l'opérateur).

**Retrait** : le joueur demande un retrait vers son numéro Mobile Money ; le montant est débité (bloqué) tout de suite,
puis un compte Maison le **valide** ou le **refuse** (le montant est alors restitué) depuis `/maison`.
Simulation également : rien n'est réellement envoyé.

Chaque opération est inscrite dans le journal des transactions (dépôt, retrait, retrait annulé, conversion)
et dans la liste des paiements (`payments` dans `data/db.json`).

**Brancher un vrai agrégateur de paiement** (CinetPay, PayDunya, Hub2, FedaPay…) : implémentez l'interface
`PaymentProvider` (`lib/payments/types.ts` : `collect` pour encaisser, `payout` pour envoyer), enregistrez-la dans
`lib/payments/index.ts` et lancez avec `PAYMENT_PROVIDER=<id>`. Un vrai fournisseur répond souvent « en attente » :
il faudra alors ajouter une route de **webhook** qui confirme le paiement et crédite le solde.

## Configuration (`lib/config.ts`, modifiable aussi par variables d'environnement)

| Paramètre | Défaut | Rôle |
| --- | --- | --- |
| `FCFA_PER_LION` | 500 | Valeur d'1 Lion en F CFA (**hypothèse à fixer**) |
| `DEPOSIT_MIN_FCFA` / `DEPOSIT_MAX_FCFA` | 200 / 500 000 | Limites d'un dépôt |
| `WITHDRAW_MIN_FCFA` / `WITHDRAW_MAX_FCFA` | 500 / 500 000 | Limites d'un retrait |
| `PAYMENT_PROVIDER` | `simulation` | Fournisseur de paiement |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | (vide = keyless en dev) | Clés Clerk (connexion / inscription) |
| `ADMIN_EMAILS` | (vide) | E-mails des comptes administrateurs (Clerk) |
| `ADMIN_USERNAMES` | (vide) | Pseudos des comptes administrateurs |
| `FARIMA_DATA_DIR` | `./data` | Dossier de la base (utile pour une base de test) |

## ⚠️ Avant toute mise en ligne avec de l'argent réel

- Les dépôts, retraits et conversions sont **simulés** dans cette version : aucun argent réel n'est encaissé ni versé.
  Rendre les Lions ou les F CFA convertibles en argent réel change le statut juridique de la plateforme. Faites valider le projet par un juriste.
- Il faudra aussi : un vrai agrégateur de paiement avec webhooks, une vérification d'identité (KYC) et de l'âge (18 ans),
  des limites de jeu responsable, une base de données de production et un audit de sécurité.

## Les jeux

- **Awalé** (variante Abapa) : 2 × 6 trous, 4 graines par trou. Semis anti-horaire, on saute le trou de départ
  à partir de 12 graines. Capture par 2 ou 3 dans le camp adverse, en remontant les trous précédents.
  Grand chelem interdit (le coup est joué mais ne capture rien). Obligation de nourrir l'adversaire ;
  si c'est impossible, chacun ramasse les graines de son camp. 25 graines ou plus = victoire, 24-24 = nul.
  Anti-boucle : après 300 coups, chacun ramasse son camp.
- **Jeu de Dames** (dames internationales 10 × 10) : les blancs commencent, prise obligatoire et majoritaire,
  les pions prennent aussi en arrière, dames volantes, promotion seulement en fin de coup.
  Un joueur bloqué ou sans pièces perd. Nul après 50 coups consécutifs de dames sans prise.
- **Échecs** : règles complètes (roque, prise en passant, promotion, pat, triple répétition, 50 coups,
  matériel insuffisant) grâce à la bibliothèque `chess.js`. Le joueur 1 a les blancs.
- **Ludo** : 4 pions par joueur, un 6 pour sortir un pion, un 6 rejoue (trois 6 d'affilée = tour perdu),
  capture en arrivant sur un pion adverse (sauf cases ★ et cases de départ) avec lancer bonus, lancer bonus
  aussi quand un pion arrive à la maison, nombre exact pour finir. Le premier à rentrer ses 4 pions gagne.
  Simplification : pas de « blocs ». Quand un seul déplacement est possible, il est joué automatiquement.

**Ordinateur** : Awalé (minimax profondeur 6), Dames (alpha-bêta profondeur 4-5), Échecs (alpha-bêta
2-3 demi-coups, niveau débutant), Ludo (heuristique : sortir, capturer, se mettre à l'abri…).

**Multijoueur** : les joueurs (chacun avec son compte, sur son propre navigateur ou appareil) rejoignent la même
table depuis le salon ; l'état de la partie est synchronisé par interrogation du serveur toutes les 1,5 s
(pas de WebSocket dans cette première version).

## Architecture

```
app/                 pages + API (route handlers)
  connexion, inscription   écrans Clerk <SignIn/> / <SignUp/> (routes [[...rest]])
  api/me             utilisateur connecté + configuration
  api/wallet         historique et statistiques
  api/pro            passage Pro et conversion
  api/tables         liste / création de tables ; api/tables/[id] : rejoindre, quitter, jouer, abandonner
  api/house          caisse de la maison et validation des retraits (Maison)
  api/portefeuille   solde F CFA : dépôt, retrait, conversion Lions -> F CFA
components/          interface (plateaux de jeu dans components/games)
lib/games/           moteurs de règles (purs, partagés client/serveur) + IA
lib/server/          base JSON, authentification, portefeuille, tables, paiements (payments.ts)
lib/payments/        fournisseurs Mobile Money (simulation) et interface pour un vrai agrégateur
lib/config.ts        paramètres économiques
lib/clerk.ts         réglages Clerk (pages réservées, URLs) ; lib/clerk-appearance.ts : thème et textes FR
proxy.ts             session Clerk + redirection des pages réservées vers /connexion
data/db.json         base de données locale (créée automatiquement, ignorée par git)
```

- **Stockage** : un fichier JSON (`data/db.json`) écrit de façon atomique ; aucun module natif requis.
  Pour repartir de zéro, arrêtez le serveur et supprimez le dossier `data/`.
- **Comptes** : Clerk (mots de passe, e-mails, sessions) ; la fiche joueur locale est reliée par `clerkId` (`lib/server/auth.ts`).

## Limites connues / pistes

- Synchronisation multijoueur par polling (une version WebSocket serait plus réactive).
- Base JSON adaptée à un usage local / démo ; pour la production, passer à PostgreSQL ou SQLite.
- Paiements Mobile Money simulés (pas de webhook, pas de KYC).
- Pas de minuterie par coup (seulement la réclamation après 2 minutes d'inactivité).
