from rest_framework import serializers
from django.contrib.auth.models import User
from .models import City, Crag, Wall, BoulderProblem, BoulderImage


class CitySerializer(serializers.ModelSerializer):
    crag_count = serializers.SerializerMethodField()
    
    class Meta:
        model = City
        fields = [
            'id', 'name', 'description',
            'crag_count', 'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_crag_count(self, obj):
        return obj.crag_count


class CityListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for city list views"""
    crag_count = serializers.SerializerMethodField()
    
    class Meta:
        model = City
        fields = ['id', 'name', 'crag_count']

    def get_crag_count(self, obj):
        return obj.crag_count


class BoulderImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoulderImage
        fields = ['id', 'image', 'caption', 'is_primary', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class WallSerializer(serializers.ModelSerializer):
    problem_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Wall
        fields = [
            'id', 'crag', 'name', 'description',
            'problem_count', 'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_problem_count(self, obj):
        return obj.problem_count


class CragSerializer(serializers.ModelSerializer):
    problem_count = serializers.SerializerMethodField()
    city_detail = CityListSerializer(source='city', read_only=True)
    walls = WallSerializer(many=True, read_only=True)
    
    class Meta:
        model = Crag
        fields = [
            'id', 'city', 'city_detail', 'name', 'description', 'latitude', 'longitude',
            'problem_count', 'walls',
            'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_problem_count(self, obj):
        return obj.problem_count


class CragListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for crag list views"""
    problem_count = serializers.SerializerMethodField()
    city_name = serializers.CharField(source='city.name', read_only=True, allow_null=True)
    
    class Meta:
        model = Crag
        fields = [
            'id', 'city', 'city_name', 'name', 'latitude', 'longitude',
            'problem_count'
        ]

    def get_problem_count(self, obj):
        return obj.problem_count


class BoulderProblemSerializer(serializers.ModelSerializer):
    crag_detail = CragListSerializer(source='crag', read_only=True)
    wall_detail = WallSerializer(source='wall', read_only=True)
    images = BoulderImageSerializer(many=True, read_only=True)
    tick_count = serializers.SerializerMethodField()
    
    class Meta:
        model = BoulderProblem
        fields = [
            'id', 'crag', 'crag_detail', 'wall', 'wall_detail', 'name', 'grade', 'description',
            'images', 'tick_count', 'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_tick_count(self, obj):
        return obj.ticks.count()


class BoulderProblemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for problem list views"""
    crag_name = serializers.CharField(source='crag.name', read_only=True)
    wall_name = serializers.CharField(source='wall.name', read_only=True, allow_null=True)
    tick_count = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()
    
    class Meta:
        model = BoulderProblem
        fields = [
            'id', 'crag', 'crag_name', 'wall', 'wall_name',
            'name', 'grade', 'tick_count', 'primary_image'
        ]

    def get_tick_count(self, obj):
        return obj.ticks.count()
    
    def get_primary_image(self, obj):
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            return primary.image.url
        return None
