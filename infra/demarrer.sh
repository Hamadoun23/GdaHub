#!/bin/sh
# Demarrage complet de GDA Hub en local.
#
#   sh infra/demarrer.sh
#
# Construit et lance les 28 conteneurs, attend que la passerelle reponde,
# verse les donnees de production dans les bases vides, cree les comptes du
# hub, puis affiche les adresses et les acces.
#
# Rejouable : relance sans rien casser une pile deja demarree. La reprise des
# donnees, elle, recree les bases — voir infra/reprise-donnees.sh.

set -e

racine=$(cd "$(dirname "$0")/.." && pwd)
cd "$racine"

titre() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
vert()  { printf '  ok    %s\n' "$1"; }
rouge() { printf '  !!    %s\n' "$1"; }

titre 'Construction et demarrage'
docker compose up -d --build

titre 'Attente de la passerelle'
essais=0
while [ "$essais" -lt 90 ]; do
    if curl -fsS -o /dev/null http://localhost:8080/sante/identity 2>/dev/null; then
        vert 'la passerelle repond'
        break
    fi
    essais=$((essais + 1))
    sleep 2
done
if [ "$essais" -ge 90 ]; then
    rouge 'la passerelle ne repond pas apres trois minutes'
    echo '  Regardez : docker compose logs gateway identity'
    exit 1
fi

titre 'Comptes du hub'
docker compose exec -T identity python manage.py amorcer

titre 'Reprise des donnees de production'
sh infra/reprise-donnees.sh

titre 'Migrations des applications rassemblees'
# Les sauvegardes viennent de la production : le schema y est deja. Ces
# commandes ne rattrapent que les migrations posterieures a la sauvegarde.
docker compose exec -T financerh-api python manage.py migrate --noinput || rouge 'FinanceRH : migrations a verifier'
docker compose exec -T jusorange-api python manage.py migrate --noinput || rouge "Jus d'orange : migrations a verifier"
docker compose exec -T bdm-app     python manage.py migrate --noinput || rouge 'BDM : migrations a verifier'

titre 'GDA Hub est en ligne'
cat <<'FIN'

  http://localhost:8080            la porte d'entree
    /rh/                           FinanceRH
    /jus/                          Jus d'orange
    /bdm/                          BDM

  Connexion au hub
    hcisse@gdamali.net / admin     super admin
    (comptes de demonstration : mot de passe 12345)

  Dans les applications, les mots de passe restent ceux de la production.

  Le compte unique ne suit d'une application a l'autre que si la
  correspondance des identifiants est renseignee : les comptes de Jus
  d'orange et de BDM ne portent pas d'adresse @gdamali.net. Cela se remplit
  dans l'administration du hub, sur chaque habilitation.

FIN
