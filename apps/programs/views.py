import datetime
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.programs.models import Program, Workout
from apps.programs.serializers import ProgramSerializer, WorkoutSerializer

class ProgramViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Program.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        program_to_activate = self.get_object()
        user = request.user

        try:
            with transaction.atomic():
                Program.objects.filter(user=user, status='active').exclude(id=program_to_activate.id).update(status='inactive')
                program_to_activate.status = 'active'
                program_to_activate.save()

            return Response({"status": "success", "message": f"'{program_to_activate.title}' aktif edildi."}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='create_ai_plan')
    def create_ai_plan(self, request):
        data = request.data
        user = request.user
        
        try:
            with transaction.atomic():
                # Eskileri pasife çek
                Program.objects.filter(user=user, status='active').update(status='inactive')

                try:
                    start_date_obj = datetime.datetime.strptime(data['start_date'], "%Y-%m-%d").date()
                except ValueError:
                    return Response({"error": "Start date format error (YYYY-MM-DD)"}, status=400)

                end_date_obj = start_date_obj + timedelta(weeks=int(data['duration_weeks']))

                program = Program.objects.create(
                    user=user,
                    title=data['title'],
                    description=data.get('description', ''),
                    start_date=start_date_obj,
                    end_date=end_date_obj,
                    duration_weeks=int(data['duration_weeks']),
                    status='active',
                    workouts_per_week=int(data.get('workouts_per_week', 3)), 
                    difficulty='beginner',
                    total_workouts_count=len(data['workouts'])
                )

                workout_objects = []
                for w_data in data['workouts']:
                    real_date = start_date_obj + timedelta(days=int(w_data['day_offset']))
                    
                    w = Workout(
                        program=program,
                        title=w_data['title'],
                        workout_type=w_data['workout_type'],
                        scheduled_date=real_date,
                        planned_distance=float(w_data['distance_km']),
                        planned_duration=int(w_data.get('duration_minutes', 0)),
                        target_pace_seconds=int(w_data.get('target_pace_seconds', 0))
                    )
                    workout_objects.append(w)
                
                for w in workout_objects:
                    w.save()

            return Response({
                "status": "success", 
                "program_id": str(program.id),
                "message": "Yeni plan aktif edildi."
            }, status=201)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)


class WorkoutViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        today = timezone.now().date()

        # Otomatik Missed Güncellemesi
        Workout.objects.filter(
            program__user=user,
            scheduled_date__lt=today,
            is_completed=False
        ).exclude(
            status='missed' # Enum kullanıyorsan Workout.Status.MISSED
        ).update(status='missed')

        queryset = Workout.objects.filter(program__user=user)

        if self.request.query_params.get('only_active') == 'true':
            queryset = queryset.filter(program__status='active')

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(scheduled_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(scheduled_date__lte=end_date)

        return queryset.order_by('scheduled_date')