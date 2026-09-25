# Deploiement avec commentaires persistants

Le site utilise maintenant un petit serveur Node et SQLite pour les commentaires.

## En local

```bash
npm start
```

Puis ouvrir `http://localhost:8000`.

La base est creee automatiquement dans `comments.db`.

## En ligne

Utiliser un hebergeur qui accepte une application Node (Render, Railway, Fly.io ou un serveur VPS), avec :

- commande de demarrage : `npm start`
- variable `PORT` fournie par l'hebergeur
- stockage disque persistant pour le fichier `comments.db`

Sans disque persistant, les commentaires fonctionneront mais risquent d'etre effaces lors d'un redeploiement ou redemarrage. Sur Render, par exemple, il faut ajouter un disque persistant monte dans le dossier du projet, ou adapter le chemin de la base dans `server.js`.

L'API utilisee par le site est :

- `GET /api/comments?track=omen`
- `POST /api/comments?track=omen` avec `{ "name": "Nom", "text": "Commentaire" }`
