#!/bin/sh
# Recette de bout en bout de GDA Hub.
#
#   sh infra/recette.sh
#
# A lancer apres « docker compose up -d », sur une installation neuve. Le
# script parle a l'ERP comme le ferait un navigateur : uniquement par la
# passerelle, uniquement avec des jetons obtenus par la page de connexion.
#
# Il verifie ce qu'aucun test unitaire ne peut verifier — que les neuf
# services se reconnaissent entre eux, qu'un jeton signe par identity est
# accepte partout, et qu'un conge traverse reellement son circuit.
set -e

BASE="${GDAHUB_BASE:-http://localhost:8080}"
MDP_DEMO="${GDAHUB_MDP_DEMO:-12345}"
ok=0
ko=0

verifier() { # intitule attendu obtenu
    if [ "$2" = "$3" ]; then
        printf '  ok    %s\n' "$1"
        ok=$((ok + 1))
    else
        printf '  ECHEC %s (attendu %s, obtenu %s)\n' "$1" "$2" "$3"
        ko=$((ko + 1))
    fi
}

code() { # methode chemin [jeton] [corps]
    if [ -n "$4" ]; then
        curl -s -m 30 -o /dev/null -w '%{http_code}' -X "$1" "$BASE$2" \
            -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$4"
    else
        curl -s -m 30 -o /dev/null -w '%{http_code}' -X "$1" "$BASE$2" \
            ${3:+-H "Authorization: Bearer $3"}
    fi
}

corps() { # methode chemin jeton [donnees]
    if [ -n "$4" ]; then
        curl -s -m 30 -X "$1" "$BASE$2" -H "Authorization: Bearer $3" \
            -H 'Content-Type: application/json' -d "$4"
    else
        curl -s -m 30 -X "$1" "$BASE$2" -H "Authorization: Bearer $3"
    fi
}

jeton_de() { # identifiant mot_de_passe
    curl -s -m 30 -X POST "$BASE/api/identity/auth/connexion" \
        -H 'Content-Type: application/json' \
        -d "{\"identifiant\":\"$1\",\"mot_de_passe\":\"$2\"}" \
        | python -c 'import json,sys; print(json.load(sys.stdin).get("acces",""))'
}

echo
echo '1. Les neuf services repondent'
for service in identity organisation rh finance direction bdm orange daily planning; do
    verifier "sante $service" 200 "$(code GET "/sante/$service")"
done

echo
echo '2. La cle publique est publiee'
verifier 'jwks' 200 "$(code GET '/.well-known/jwks.json')"

echo
echo '3. Le shell repond'
for page in / /connexion /tableau-de-bord /ressources-humaines /organisation \
            /finance /direction /chantiers /planning /jus-orange /campagnes; do
    verifier "page $page" 200 "$(code GET "$page")"
done

echo
echo '4. Un compte unique ouvre les neuf applications'
ADMIN=$(jeton_de "${GDAHUB_ADMIN:-hcisse@gdamali.net}" "${GDAHUB_MDP:-admin}")
if [ -z "$ADMIN" ]; then
    echo '  ECHEC connexion du super administrateur'
    exit 1
fi
echo '  ok    connexion'

echo
echo '5. Un jeton signe par identity est accepte par les huit autres services'
for route in organisation/agents rh/tableau-de-bord finance/tableau-de-bord \
             direction/tableau-de-bord bdm/tableau-de-bord orange/tableau-de-bord \
             daily/tableau-de-bord planning/tableau-de-bord; do
    verifier "$route" 200 "$(code GET "/api/$route" "$ADMIN")"
done

echo
echo '6. Sans jeton, rien ne passe'
verifier 'annuaire sans jeton' 401 "$(code GET '/api/organisation/agents')"
verifier 'conges sans jeton' 401 "$(code GET '/api/rh/demandes-absence')"

echo
echo "7. Un conge traverse son circuit (mot de passe de demonstration : $MDP_DEMO)"
AGENT=$(jeton_de 'g.raphiste@exemple.net' "$MDP_DEMO")
DG=$(jeton_de 'd.general@exemple.net' "$MDP_DEMO")
if [ -z "$AGENT" ] || [ -z "$DG" ]; then
    echo '  (ignore : effectif de demonstration absent)'
else
    ID=$(corps POST /api/rh/demandes-absence "$AGENT" \
        '{"type_absence":"Conge annuel","date_debut":"2027-03-01","date_fin":"2027-03-03","motif":"Recette"}' \
        | python -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
    verifier 'demande creee avec son instantane' 1 "$([ -n "$ID" ] && echo 1 || echo 0)"

    ETAPES=$(corps POST "/api/rh/demandes-absence/$ID/soumettre" "$AGENT" '{}' \
        | python -c 'import json,sys; print(len(json.load(sys.stdin).get("etapes",[])))')
    verifier 'circuit a cinq niveaux' 5 "$ETAPES"

    STATUT=$(corps POST "/api/rh/demandes-absence/$ID/valider" "$DG" '{"commentaire":"Recette"}' \
        | python -c 'import json,sys; print(json.load(sys.stdin).get("statut",""))')
    verifier 'la decision du DG clot le dossier' APPROUVE "$STATUT"

    JOURS=$(corps GET '/api/rh/presences?taille=50' "$AGENT" \
        | python -c 'import json,sys; d=json.load(sys.stdin); print(sum(1 for p in d["resultats"] if "2027-03" in p["date"]))')
    verifier 'les journees sont portees au registre' 3 "$JOURS"

    # Le dossier precedent est clos : une decision de plus y serait refusee
    # parce qu'il est tranche, pas parce que son auteur s'y prononce. On en
    # ouvre donc un second, encore en circulation, pour eprouver la bonne
    # regle.
    AUTRE=$(corps POST /api/rh/demandes-absence "$AGENT" '{"type_absence":"Conge annuel","date_debut":"2027-04-05","date_fin":"2027-04-06","motif":"Recette bis"}' | python -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
    corps POST "/api/rh/demandes-absence/$AUTRE/soumettre" "$AGENT" '{}' > /dev/null
    verifier 'nul ne tranche sur son propre dossier' 403 "$(code POST "/api/rh/demandes-absence/$AUTRE/valider" "$AGENT" '{"commentaire":"x"}')"
    verifier 'un dossier clos ne se rejuge pas' 400 "$(code POST "/api/rh/demandes-absence/$ID/valider" "$DG" '{"commentaire":"x"}')"
fi

echo
echo "-------------------------------------------"
printf 'Recette : %s verifications reussies, %s en echec\n' "$ok" "$ko"
[ "$ko" -eq 0 ] || exit 1
