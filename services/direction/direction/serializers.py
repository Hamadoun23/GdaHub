"""Representations JSON du domaine Direction."""

from rest_framework import serializers

from direction.models import SyntheseMensuelle


class SyntheseMensuelleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyntheseMensuelle
        fields = [
            "id",
            "mois",
            "application",
            "indicateurs",
            "construite_par",
            "cree_le",
        ]
        read_only_fields = ["construite_par"]
