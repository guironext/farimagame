# FarimaGame — plateforme de jeux (Ludo, Dames, Awalé, Échecs) et paris sportifs

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

## Pages

| Page | Adresse |
| --- | --- |
| Accueil | `/` |
| Inscription / Connexion | `/inscription`, `/connexion` |
| Tableau de bord (soldes, statistiques, historique) | `/tableau-de-bord` |
| Salon de jeu (lobby) | `/salon` |
| Partie | `/jeu/<id>` |
| Niveau Pro & conversion Coris → Lions | `/pro` |
| Paris sportifs (matchs par compétition, pots en direct) | `/paris` |
| Détail d'un match (marchés, ticket de pari) | `/paris/match/<id>` |
| Mes paris (en cours / gagnés / perdus / remboursés) | `/paris/mes-paris` |
| Portefeuille F CFA (dépôt, retrait, conversion Lions → F CFA, historique) | `/portefeuille` |
| Administration des paris (**ADMIN**) | `/admin/paris` |
| La Maison – commissions, caisse (**ADMIN**) | `/maison` |

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
8. Les Coris et les Lions restent une monnaie virtuelle de jeu. Le F CFA (paris sportifs) est décrit ci-dessous ;
   dans cette version, **tous les paiements sont simulés**.

## Rôles

- **JOUEUR** : rôle par défaut.
- **ADMIN** : accès à `/admin/paris` (règlement des matchs, retraits, commissions) et à `/maison`.
  - Par défaut, **le premier compte créé** dans la base devient ADMIN (y compris dans une base existante).
  - Ou bien, définissez la variable d'environnement `ADMIN_USERNAMES` (pseudos séparés par des virgules) :
    `ADMIN_USERNAMES=gerard,moussa npm run dev`. Dans ce cas, **seuls** ces comptes sont ADMIN.

## Portefeuille F CFA (XOF)

Troisième solde, en **francs CFA entiers**, utilisé pour les paris sportifs. Deux façons de l'alimenter :

1. **Convertir des Lions en F CFA** (joueurs **Pro** uniquement, par Lion entier) au taux `FCFA_PER_LION`
   (**500 F CFA par Lion par défaut — HYPOTHÈSE à fixer par vous**).
   Chaîne complète : 50 Coris → 1 Lion → 500 F CFA.
2. **Dépôt Mobile Money** : Orange Money, MTN MoMo, Wave ou Moov Money, numéro ivoirien à 10 chiffres.
   **Mode démo / simulation** : aucun argent réel ne circule, le dépôt est crédité immédiatement
   (un numéro finissant par `0000` simule un refus de l'opérateur).

**Retrait** : le joueur demande un retrait vers son numéro Mobile Money ; le montant est débité (bloqué) tout de suite,
puis un ADMIN le **valide** ou le **refuse** (le montant est alors restitué) depuis `/admin/paris` → onglet Retraits.
Simulation également : rien n'est réellement envoyé.

Chaque opération est inscrite dans le journal des transactions (dépôt, retrait, retrait annulé, conversion, pari,
gain de pari, remboursement) et dans la liste des paiements (`payments` dans `data/db.json`).

**Brancher un vrai agrégateur de paiement** (CinetPay, PayDunya, Hub2, FedaPay…) : implémentez l'interface
`PaymentProvider` (`lib/payments/types.ts` : `collect` pour encaisser, `payout` pour envoyer), enregistrez-la dans
`lib/payments/index.ts` et lancez avec `PAYMENT_PROVIDER=<id>`. Un vrai fournisseur répond souvent « en attente » :
il faudra alors ajouter une route de **webhook** qui confirme le paiement et crédite le solde.

## Paris sportifs (football)

**Compétitions** : Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Ligue des champions UEFA, Coupe d'Afrique
des Nations (CAN), Ligue des champions CAF, Ligue 1 ivoirienne, éliminatoires de la Coupe du monde (zones Afrique et
Europe) et éliminatoires de la CAN. Liste et filtres dans `/paris` (onglets Ligues européennes / Ligue des champions /
Matchs africains / Éliminatoires, puis par compétition, et À venir / En cours / Résultats).

**Marchés** : Résultat 1 N 2 (temps réglementaire), Les deux équipes marquent (Oui / Non), Plus / Moins de 2,5 buts.

**Pari mutuel** (par match et par marché) :

- Mise en F CFA entiers, de `BET_MIN_FCFA` (100 F) à `BET_MAX_FCFA` (100 000 F). On peut faire plusieurs paris.
- Toutes les mises d'un marché forment un **pot**. Au règlement, la **maison garde 10 %**, les **gagnants se partagent
  90 %** au prorata de leur mise (arrondi au franc inférieur ; les centimes restants vont à la maison).
  Exemple : 6 000 F dans le pot, 4 000 F sur l'issue gagnante → 5 400 F à partager ; celui qui a misé 3 000 F reçoit 4 050 F.
- **Toutes les issues affichent une cote** (jamais « — »), voir « Cotes » ci-dessous. C'est une **estimation** :
  en pari mutuel, le gain réel est fixé par le pot final. Le ticket reprend la cote affichée et calcule le gain estimé
  (mise × cote), libellé « estimation ».
- Les paris **ferment au coup d'envoi**.
- **Remboursement intégral** (sans commission) si : le match est **reporté ou annulé** ; **personne n'a misé sur l'issue
  gagnante** ; ou **tout le monde a misé sur l'issue gagnante** (aucun perdant — sinon les gagnants perdraient 10 %).
  Conséquence : un parieur seul sur un marché est toujours remboursé.
- **Règlement automatique** : à chaque consultation des matchs, la liste est synchronisée avec la source de données
  (au plus toutes les minutes en démo, toutes les 15 minutes avec API-Football) et chaque match terminé, reporté ou
  annulé est réglé une seule fois. Un ADMIN peut aussi fixer le score final (ou déclarer le match reporté / annulé)
  depuis `/admin/paris` : le résultat manuel n'est plus écrasé par la synchronisation. Un match réglé ne l'est
  qu'une fois (une correction de score ultérieure par la source est ignorée).

### Cotes

La cote affichée pour chaque issue mélange une **cote de référence** et la **cote du pot** :

1. **Cote de référence** (probabilité « juste » `r`, sans marge) :
   - **Cotes bookmakers** (étiquette verte) si `ODDS_API_KEY` est défini et que le match est trouvé chez
     [The Odds API](https://the-odds-api.com) : pour chaque issue on prend la **cote médiane** des bookmakers (région `eu`),
     on retire leur marge (`r = (1/cote) ÷ Σ(1/cotes)`), puis on applique **notre** marge de 10 % (étape 3). Nos cotes sont
     donc un peu plus basses que celles des bookmakers (≈ 5 % de marge chez eux, 10 % chez nous), ce qui reste cohérent
     avec le règlement 90/10. Marchés utilisés : `h2h` (1 N 2) et `totals` (ligne 2,5). « Les deux équipes marquent »
     n'existe pas dans l'offre de base : il est déduit des buts attendus calés sur ces cotes (modèle ci-dessous).
   - **Cotes FarimaGame** (étiquette grise) sinon (pas de clé, match non trouvé, compétition non couverte, erreur d'API) :
     modèle `lib/odds/model.ts` à partir de la **note de force** de chaque équipe (`lib/odds/teams.ts`, ~250 équipes,
     note par défaut par compétition pour les inconnues) :
     - écart `d = note_dom + avantage du terrain − note_ext ± 20` (petite « forme du jour » déterministe par match) ;
     - buts attendus `λdom = (T + 0,0035·d)/2`, `λext = (T − 0,0035·d)/2` (T = moyenne de buts de la compétition) ;
     - grille de scores de Poisson avec correction Dixon-Coles (ρ = −0,10) → 1 N 2, les deux équipes marquent, +/- 2,5 buts.
2. **Cote du pot** : part des mises `m = mises sur l'issue ÷ pot`.
3. **Mélange** : `w = pot ÷ (pot + K)` avec `K = BET_ODDS_BLEND_K` (20 000 F par défaut) ;
   `p = (1 − w)·r + w·m` ; **cote = 0,9 ÷ p** (arrondie au centième, entre 1,01 et 250).
   Sans mise, la cote de référence s'affiche telle quelle ; avec un pot de 20 000 F, référence et pot comptent autant ;
   avec un très gros pot, la cote rejoint la cote du pot (= le vrai pari mutuel). La somme des `1/cote` d'un marché
   vaut toujours ≈ 1/0,9 ≈ 1,111 (marge de 10 %).
4. **Règlement inchangé** : pari mutuel 90/10 sur le pot final, mêmes règles de remboursement.

**Activer les vraies cotes bookmakers** :

1. Créez une clé gratuite sur https://the-odds-api.com (offre gratuite : 500 crédits/mois).
2. Ajoutez dans `.env.local` (à la racine du projet, voir `.env.local.example`) : `ODDS_API_KEY=votre_cle`
3. Relancez le serveur : arrêtez `npm run dev` (Ctrl+C) puis relancez `npm run dev`.
4. Vérifiez dans `/admin/paris` (bloc « Cotes de référence ») : statut, dernière mise à jour, crédits restants.

⚠️ Les cotes bookmakers ne s'appliquent qu'aux **vrais matchs** : avec les matchs de démonstration (fictifs), aucun
match ne peut correspondre, donc l'API n'est pas appelée (pour ne pas gaspiller de crédits) et les cotes FarimaGame
restent affichées. Activez aussi `API_FOOTBALL_KEY` pour les vrais matchs.

Compétitions couvertes par The Odds API (clés vérifiées sur la liste publique des sports) : Premier League
`soccer_epl`, LaLiga `soccer_spain_la_liga`, Serie A `soccer_italy_serie_a`, Bundesliga `soccer_germany_bundesliga`,
Ligue 1 `soccer_france_ligue_one`, Ligue des champions `soccer_uefa_champs_league`, CAN `soccer_africa_cup_of_nations`,
éliminatoires CdM Europe `soccer_fifa_world_cup_qualifiers_europe`. **Non couvertes** (cotes FarimaGame) : Ligue des
champions CAF, Ligue 1 ivoirienne, éliminatoires CdM Afrique, éliminatoires CAN. Une clé peut être ajoutée ou
remplacée sans toucher au code : `ODDS_API_SPORTS=wcq-afr=soccer_xxx`.

**Rapprochement des matchs** : même compétition, mêmes équipes (noms normalisés : accents, « FC », « AS »… ignorés, plus
une table d'alias français/anglais, ex. « FC Barcelone » = « Barcelona », « Côte d'Ivoire » = « Ivory Coast ») et coup
d'envoi à moins de 6 h d'écart.

**Quota / cache** : l'API n'est **jamais** appelée à chaque page vue. Les réponses sont gardées dans `data/db.json`
(clé `oddsApi`) et rafraîchies en arrière-plan quand le cache est périmé, uniquement pour les compétitions ayant un
match ouvert dans les 7 jours. Un appel coûte 2 crédits par compétition (`h2h,totals` × 1 région). Le prochain
rafraîchissement est planifié pour répartir les crédits restants (en-tête `x-requests-remaining`) jusqu'à la fin du
mois, avec un minimum de `ODDS_API_REFRESH_MINUTES` (15 min) : avec l'offre gratuite et 8 compétitions, cela fait
environ un rafraîchissement par jour ; avec une offre payante, toutes les 15 minutes. Les cotes d'avant-match d'un
match commencé sont figées. Clé refusée (401) ou quota épuisé (429) : arrêt immédiat, nouvel essai 30 min plus tard,
cotes FarimaGame en attendant. La clé n'est jamais affichée ni écrite dans la base.

**Source des matchs** (`lib/sports`, interface `SportsProvider`) :

- **Démo (par défaut)** : matchs **fictifs** avec de vrais noms d'équipes, générés de 3 jours avant à 14 jours après la
  date du jour selon un calendrier réaliste (week-end pour les championnats, mardi/mercredi pour la LDC…). Un match démo
  reçoit un score fictif 2 h après le coup d'envoi (≈ 4 % sont « reportés »), ce qui déclenche le règlement automatique.
  Tous les écrans affichent clairement « Données de démonstration ».
- **API-Football** (api-sports.io) : activé dès que `API_FOOTBALL_KEY` est défini, par ex. dans un fichier `.env.local` :
  ```
  API_FOOTBALL_KEY=votre_cle
  # facultatif :
  API_FOOTBALL_SEASON=2026
  API_FOOTBALL_LEAGUES=ci-ligue1=386,canq=36
  ```
  Une synchronisation = 1 requête par compétition (12), au plus toutes les 15 minutes. Les identifiants de compétitions
  sont dans `lib/sports/competitions.ts` : **vérifiez-les** dans votre tableau de bord API-Football
  (ou `GET /leagues?search=...`), surtout Ligue 1 ivoirienne, éliminatoires et CAN, puis corrigez-les au besoin avec
  `API_FOOTBALL_LEAGUES`. L'offre gratuite d'API-Football est limitée (≈ 100 requêtes/jour et saisons restreintes).
  Ce connecteur n'a pas pu être testé sans clé.

## Configuration (`lib/config.ts`, modifiable aussi par variables d'environnement)

| Paramètre | Défaut | Rôle |
| --- | --- | --- |
| `FCFA_PER_LION` | 500 | Valeur d'1 Lion en F CFA (**hypothèse à fixer**) |
| `DEPOSIT_MIN_FCFA` / `DEPOSIT_MAX_FCFA` | 200 / 500 000 | Limites d'un dépôt |
| `WITHDRAW_MIN_FCFA` / `WITHDRAW_MAX_FCFA` | 500 / 500 000 | Limites d'un retrait |
| `BET_MIN_FCFA` / `BET_MAX_FCFA` | 100 / 100 000 | Limites d'une mise |
| `BET_WINNERS_SHARE` / `BET_HOUSE_SHARE` | 90 % / 10 % | Partage du pot des paris sportifs (`BET_WINNERS_SHARE` réglable par variable d’environnement) |
| `PAYMENT_PROVIDER` | `simulation` | Fournisseur de paiement |
| `ADMIN_USERNAMES` | (vide) | Comptes administrateurs |
| `API_FOOTBALL_KEY` | (vide) | Active les vrais matchs |
| `ODDS_API_KEY` | (vide) | Active les vraies cotes bookmakers (The Odds API) |
| `ODDS_API_REFRESH_MINUTES` | 15 | Délai minimal entre deux rafraîchissements des cotes |
| `BET_ODDS_BLEND_K` | 20 000 | Taille du pot (F CFA) à partir de laquelle le pot pèse autant que la cote de référence |
| `FARIMA_DATA_DIR` | `./data` | Dossier de la base (utile pour une base de test) |

## ⚠️ Avant toute mise en ligne avec de l'argent réel

- En Côte d'Ivoire, les **paris sportifs en argent réel** sont un monopole encadré par l'État : il faut un
  **agrément / une licence d'opérateur (LONACI)** avant d'ouvrir le service au public. Faites valider le projet par un juriste.
- Les dépôts, retraits et conversions sont **simulés** dans cette version : aucun argent réel n'est encaissé ni versé.
  Rendre les Lions ou les F CFA convertibles en argent réel change le statut juridique de la plateforme.
- Il faudra aussi : un vrai agrégateur de paiement avec webhooks, une vérification d'identité (KYC) et de l'âge (18 ans),
  des limites de jeu responsable, une base de données de production et un audit de sécurité.

## Test de bout en bout des paris

```bash
npm run build
FARIMA_DATA_DIR=/tmp/farima-test npx next start -p 3100   # base de test séparée (le 1er compte y devient ADMIN)
node scripts/test-paris.mjs http://localhost:3100          # dans un autre terminal
```

Test des cotes (lance lui-même des serveurs de test avec une base temporaire et un faux serveur The Odds API) :

```bash
npm run build && node scripts/test-odds.mjs
```

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
  api/auth/*         inscription, connexion, déconnexion (cookie de session httpOnly)
  api/me             utilisateur connecté + configuration
  api/wallet         historique et statistiques
  api/pro            passage Pro et conversion
  api/tables         liste / création de tables ; api/tables/[id] : rejoindre, quitter, jouer, abandonner
  api/house          caisse de la maison (ADMIN)
  api/portefeuille   solde F CFA : dépôt, retrait, conversion Lions -> F CFA
  api/paris          matchs ; api/paris/match/[id] : détail ; api/paris/bets : mes paris / parier
  api/admin/paris    règlement des matchs, retraits, synchronisation (ADMIN)
components/          interface (plateaux de jeu dans components/games)
lib/games/           moteurs de règles (purs, partagés client/serveur) + IA
lib/server/          base JSON, authentification, portefeuille, tables, paris (betting.ts), paiements (payments.ts)
lib/sports/          sources de matchs : démo (demo.ts) et API-Football (apiFootball.ts), compétitions
lib/payments/        fournisseurs Mobile Money (simulation) et interface pour un vrai agrégateur
lib/betting.ts       marchés, issues, cotes affichées (mélange référence / pot, partagé client/serveur)
lib/odds/            modèle de cotes FarimaGame (model.ts), notes des équipes (teams.ts), The Odds API (oddsApi.ts)
lib/server/odds.ts   cotes de référence d'un match + cache / planification des appels à The Odds API
scripts/             tests de bout en bout des paris (test-paris.mjs) et des cotes (test-odds.mjs + fixtures/)
lib/config.ts        paramètres économiques
data/db.json         base de données locale (créée automatiquement, ignorée par git)
```

- **Stockage** : un fichier JSON (`data/db.json`) écrit de façon atomique ; aucun module natif requis.
  Pour repartir de zéro, arrêtez le serveur et supprimez le dossier `data/`.
- **Mots de passe** hachés avec scrypt (sel aléatoire), sessions de 30 jours en cookie httpOnly.

## Limites connues / pistes

- Synchronisation multijoueur par polling (une version WebSocket serait plus réactive).
- Base JSON adaptée à un usage local / démo ; pour la production, passer à PostgreSQL ou SQLite.
- Paris sportifs : pari mutuel simple (les cotes affichées sont des estimations, pas des cotes fixes ; pas de paris combinés, pas de cash-out, pas de paris en direct).
- Les notes de force des équipes (`lib/odds/teams.ts`) sont des estimations à ajuster ; le connecteur The Odds API a été testé avec des réponses simulées (pas de clé réelle).
- Les matchs démo sont fictifs ; le connecteur API-Football n'a pas été testé sans clé.
- Paiements Mobile Money simulés (pas de webhook, pas de KYC).
- Pas de minuterie par coup (seulement la réclamation après 2 minutes d'inactivité).
