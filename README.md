# Introduction
Ce répertoire réunit les informations et éléments nécessaires pour créer le bot.
Le bot fonctionne plus ou moins en français, mais grâce au Google Sheets il sera (normalement) possible de le mettre uniquement en français.
Traduit par Pancakes Studio - Scenario Factory.

# GPT-Powered Customer Support Bot for Discord
[<img src="https://open.autocode.com/static/images/open.svg?" width="192">](https://open.autocode.com/)

Il s'agit d'un robot de support client ou communautaire alimenté par les GPT. Il fonctionne en se connectant
à un Google Sheets avec trois colonnes : `Question`, `Answer` et `Embedding`.
Chaque fois qu'un utilisateur pose une question au robot, celui-ci va d'abord catégoriser la
question comme une conversation générale ou une question de support technique. S'il pense qu'il s'agit d'une
technique, il interrogera Google Sheets pour trouver la réponse la plus appropriée et
réponse la plus appropriée et répondra en conséquence.

Le champ `Embedding` est destiné à mettre en cache les données d'Embedding dans Google Sheets afin que vous n'ayez pas à réinterroger OpenAI pour les questions de support général à chaque fois.
afin que vous n'ayez pas à réinterroger OpenAI à chaque fois pour des questions de support général. Si vous
ajoutez de nouvelles questions et réponses, **vous n'avez pas besoin de remplir ce champ**.

![Support bot](/readme/gallery/1-bot-example.png)

## Exemple de données pour Google Sheets

Pour fonctionner, votre feuille Google doit contenir des données au format suivant. **Notez que
le champ "Embedding" peut être vide, votre bot le remplira automatiquement**.

| Question | Answer | Embedding |
| --- | --- | --- |
| Comment mettre à jour ma carte de crédit ? | Vous pouvez mettre à jour votre carte de crédit sur https://autocode.com/dashboard/-/account/payment-methods/ | |
| Mon bot Discord ne se connecte pas, aidez-moi ! | Essayez de le relier en mode incognito ou en désactivant les bloqueurs de fenêtres pop-up. | |
| Lorsque j'exécute mon code, il est indiqué "données de test". | Essayez de modifier votre charge utile dans l'éditeur en utilisant des identifiants réels, ou en parlant à votre point de terminaison directement depuis Discord. | |
| Pourquoi mon bot est-il hors ligne ? | Vous avez probablement utilisé vos crédits gratuits. Visitez https://autocode.com/dashboard/-/account/sub/ pour activer votre compte. | |
| Comment apprendre à coder ? | Le meilleur endroit pour commencer est notre guide des robots Discord à l'adresse https://autocode.com/guides/how-to-build-a-discord-bot/. | | |

## Ajouter d'autres questions et réponses

question. Il suffit de mettre à jour votre feuille Google pour donner à votre bot une plus grande base de connaissances.
Notez que si vous utilisez le modèle par défaut sans modification, le référentiel de questions-réponses
ne sera consulté que si le bot pense avoir rencontré une question d'assistance technique.

## Le bot ne fonctionne pas ?

Assurez-vous que [Privileged Intents](https://autocode.com/discord/threads/what-are-discord-privileged-intents-and-how-do-i-enable-them-tutorial-0c3f9977/)
sont activées pour votre robot, en particulier l'intention **Contenu du message**.
Elle est nécessaire pour répondre à l'événement `bot_mention`.

## Bon code !

Vous êtes intéressé par le fonctionnement de ce robot ? Vous voulez mieux comprendre les vecteurs d'intégration ?
Consultez le guide [How to build a GPT support Discord bot](http://autocode.com/guides/how-to-build-a-gpt-support-discord-bot/).
