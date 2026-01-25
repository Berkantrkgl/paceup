from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

# Analitik için diğer tüm app'lerin modellerine ihtiyacımız var
from apps.activity.models import WorkoutResult
from apps.programs.models import Program, Workout

class StatsSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        
        stats = WorkoutResult.objects.filter(user=user).aggregate(
            total_dist=Sum('actual_distance'),
            total_dur=Sum('actual_duration'),
            total_count=Count('id'),
            total_cal=Sum('calories_burned')
        )

        start_of_week = today - timedelta(days=today.weekday())
        this_week_count = WorkoutResult.objects.filter(
            user=user,
            completed_at__date__gte=start_of_week
        ).count()

        active_days_count = WorkoutResult.objects.filter(user=user)\
            .values('completed_at__date')\
            .distinct()\
            .count()

        return Response({
            "total_distance": round(stats.get('total_dist') or 0.0, 1),
            "total_duration_mins": stats.get('total_dur') or 0,
            "total_workouts": stats.get('total_count') or 0,
            "calories_burned": stats.get('total_cal') or 0,
            "current_streak": user.current_streak, 
            "days_active": active_days_count,
            "weekly_goal": user.weekly_goal,
            "weekly_progress": this_week_count,
        })

class StatsChartsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        period = request.query_params.get('period', 'week')
        today = timezone.now().date()
        
        if period == 'week':
            start_date = today - timedelta(days=6)
        else:
            start_date = today - timedelta(days=29)

        results = WorkoutResult.objects.filter(
            user=user, 
            completed_at__date__gte=start_date
        ).values('completed_at', 'actual_distance', 'actual_duration')

        data_map = {}
        for res in results:
            date_key = str(res['completed_at'].date())
            if date_key not in data_map:
                data_map[date_key] = {'dist': 0.0, 'dur': 0}
            data_map[date_key]['dist'] += res['actual_distance']
            data_map[date_key]['dur'] += res['actual_duration']

        labels = []
        distances = []
        paces = []

        current = start_date
        while current <= today:
            d_str = str(current)
            labels.append(current.strftime("%d/%m"))
            
            if d_str in data_map:
                val = data_map[d_str]
                dist = val['dist']
                dur = val['dur']
                distances.append(round(dist, 1))
                if dist > 0:
                    pace_val = round(dur / dist, 2)
                    paces.append(pace_val)
                else:
                    paces.append(0.0)
            else:
                distances.append(0.0)
                paces.append(0.0)
            
            current += timedelta(days=1)

        return Response({
            "labels": labels,
            "datasets": [{"data": distances}],
            "pace_data": paces
        })

class ActiveProgramStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        
        active_prog = Program.objects.filter(user=user, status='active').first()
        
        if not active_prog:
            return Response({"has_active_program": False})

        next_workout = Workout.objects.filter(
            program=active_prog,
            is_completed=False,
            scheduled_date__gte=today
        ).order_by('scheduled_date').first()

        next_workout_data = None
        if next_workout:
            next_workout_data = {
                "id": str(next_workout.id),
                "title": next_workout.title,
                "date": next_workout.scheduled_date,
                "type": next_workout.workout_type,
                "day_name": next_workout.scheduled_date.strftime("%A")
            }

        return Response({
            "has_active_program": True,
            "title": active_prog.title,
            "current_week": active_prog.current_week_calculated,
            "total_weeks": active_prog.duration_weeks,
            "total_workouts": active_prog.total_workouts_count,
            "completed_workouts": active_prog.completed_workouts_count,
            "progress_percent": active_prog.progress_percent,
            "next_workout": next_workout_data
        })