# Compresseur d'images

## Démarrage local

```bash
npm install
npm run dev
```

## Intégrer Google Analytics (GA4)

Le projet charge déjà Google Tag Manager dans `index.html` avec le conteneur `GTM-NS4676V4`.
La meilleure intégration GA4 ici est donc: **GA4 via GTM**.

### 1) Configurer la balise GA4 dans GTM

1. Ouvrir le conteneur GTM `GTM-NS4676V4`.
2. Créer une balise `Google Analytics: Configuration GA4`.
3. Renseigner ton ID de mesure GA4 (`G-XXXXXXXXXX`).
4. Déclencheur: `All Pages`.
5. Publier le conteneur.

### 2) Envoyer les événements applicatifs

`app.js` envoie déjà des événements dans `dataLayer` via `trackAnalyticsEvent(...)`.

Événements envoyés:

- `app_loaded`
- `setting_changed`
- `image_file_selected`
- `image_file_rejected`
- `processing_validation_failed`
- `image_processing_started`
- `image_processing_completed`
- `image_processing_failed`
- `image_downloaded`
- `app_reset`

### 3) Mapper les événements dans GTM

Pour chaque événement à suivre:

1. Créer un déclencheur `Custom Event` avec le nom exact (ex: `image_processing_completed`).
2. Créer une balise `GA4 Event` avec le même nom d'événement.
3. Ajouter les paramètres `dataLayer` utiles (ex: `output_size_kb`, `compression_ratio_pct`, `output_format`).
4. Associer le déclencheur correspondant.
5. Tester en mode Preview GTM, puis publier.

### 4) Vérifier dans GA4

Dans GA4:

1. `Admin` -> `DebugView` pour vérifier la remontée en temps réel.
2. Déclarer les paramètres importants en `Custom definitions` pour les exploiter dans les rapports.

## Notes conformité

Si tu as des visiteurs UE, ajoute un bandeau de consentement (et Consent Mode v2) avant de déclencher Analytics.
