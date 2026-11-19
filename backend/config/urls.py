from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts import mfa_views as mfa
from accounts import views as accounts
from coaching import views as coaching
from core import activity, feed
from core.pdf import views as program_pdf
from messaging import groups as messaging_groups
from messaging import views as messaging
from tracking import views as tracking
from training import views as training

router = DefaultRouter(trailing_slash=True)
# admin panel
router.register("admin/admins", accounts.AdminAccountViewSet, basename="admin-account")
router.register("admin/audit-events", accounts.AuditEventViewSet, basename="audit-event")
router.register("coaches", coaching.CoachViewSet, basename="coach")
# coach & athlete
router.register("coach/team", coaching.TeamViewSet, basename="coach-team")
router.register("athletes", coaching.AthleteViewSet, basename="athlete")
router.register("tests", coaching.TestDefinitionViewSet, basename="test")
router.register("coach/documents", coaching.CoachDocumentViewSet, basename="coach-document")
router.register("exercises", training.ExerciseViewSet, basename="exercise")
router.register("programs", training.ProgramViewSet, basename="program")
router.register("workouts", training.WorkoutLogViewSet, basename="workout")
router.register("sets", training.LoggedSetViewSet, basename="set")
router.register("records", training.PersonalRecordViewSet, basename="record")
router.register("meal-logs", tracking.MealLogViewSet, basename="meal-log")
router.register("water-logs", tracking.WaterLogViewSet, basename="water-log")
router.register("recovery", tracking.RecoveryCheckInViewSet, basename="recovery")
router.register("foods", tracking.FoodViewSet, basename="food")
router.register("measurements", tracking.MeasurementViewSet, basename="measurement")
router.register("test-results", tracking.TestResultViewSet, basename="test-result")
router.register("messages", messaging.MessageViewSet, basename="message")
router.register("chat-groups", messaging_groups.ChatGroupViewSet, basename="chat-group")

api = [
    # auth
    path("auth/login/", accounts.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", accounts.LogoutView.as_view(), name="logout"),
    path("auth/me/", accounts.MeView.as_view(), name="me"),
    path("auth/password/", accounts.ChangePasswordView.as_view(), name="change-password"),
    path("auth/forgot-password/", accounts.ForgotPasswordView.as_view(), name="forgot-password"),
    path("auth/reset-password/", accounts.ResetPasswordView.as_view(), name="reset-password"),
    path("auth/invites/<str:token>/", accounts.InviteView.as_view(), name="invite"),
    path("auth/2fa/", mfa.MfaStatusView.as_view(), name="mfa-status"),
    path("auth/2fa/setup/", mfa.MfaSetupView.as_view(), name="mfa-setup"),
    path("auth/2fa/enable/", mfa.MfaEnableView.as_view(), name="mfa-enable"),
    path("auth/2fa/disable/", mfa.MfaDisableView.as_view(), name="mfa-disable"),
    path("auth/2fa/recovery-codes/", mfa.MfaRecoveryCodesView.as_view(), name="mfa-recovery-codes"),
    path("auth/2fa/verify/", mfa.MfaVerifyView.as_view(), name="mfa-verify"),
    # admin
    path("admin/stats/", coaching.AdminStatsView.as_view(), name="admin-stats"),
    path("admin/activity/", activity.AdminActivityView.as_view(), name="admin-activity"),
    path("admin/activity/users/<int:pk>/", activity.AdminUserActivityView.as_view(), name="admin-user-activity"),
    path("activity/", activity.ActivityReportView.as_view(), name="activity-report"),
    path("public/", activity.PublicInfoView.as_view(), name="public-info"),
    path("admin/settings/", accounts.PlatformSettingsView.as_view(), name="admin-settings"),
    path("admin/users/<int:pk>/password/", accounts.AdminSetPasswordView.as_view(), name="admin-set-password"),
    path("admin/users/<int:pk>/sessions/", accounts.AdminUserSessionsView.as_view(), name="admin-user-sessions"),
    path("admin/users/<int:pk>/sessions/<uuid:sid>/", accounts.AdminUserSessionView.as_view(), name="admin-user-session"),
    path("auth/sessions/", accounts.MySessionsView.as_view(), name="my-sessions"),
    path("auth/sessions/end-others/", accounts.MyOtherSessionsView.as_view(), name="my-sessions-end-others"),
    path("auth/sessions/<uuid:sid>/", accounts.MySessionView.as_view(), name="my-session"),
    path("admin/users/<int:pk>/reset-link/", accounts.AdminResetLinkView.as_view(), name="admin-reset-link"),
    path("admin/users/<int:pk>/2fa-reset/", mfa.AdminMfaResetView.as_view(), name="admin-mfa-reset"),
    # coach
    path("coach/profile/", coaching.CoachProfileView.as_view(), name="coach-profile"),
    path("coach/renewal-request/", coaching.RenewalRequestView.as_view(), name="coach-renewal-request"),
    path("coach/dashboard/", coaching.CoachDashboardView.as_view(), name="coach-dashboard"),
    path("coach/threads/", messaging.ThreadListView.as_view(), name="coach-threads"),
    path("devices/", messaging.DeviceView.as_view(), name="devices"),
    path("push/config/", messaging.PushConfigView.as_view(), name="push-config"),
    path("search/", feed.SearchView.as_view(), name="search"),
    path("notifications/", feed.NotificationsView.as_view(), name="notifications"),
    path("notifications/read/", feed.NotificationsReadView.as_view(), name="notifications-read"),
    path("nutrition-plans/<str:athlete_id>/", tracking.NutritionPlanView.as_view(), name="nutrition-plan"),
    path("recovery-plans/<str:athlete_id>/", tracking.RecoveryPlanView.as_view(), name="recovery-plan"),
    path("athletes/<int:pk>/program.pdf", program_pdf.CoachProgramPdfView.as_view(), name="athlete-program-pdf"),
    path("athletes/<int:pk>/program-pdf/send/", program_pdf.SendProgramPdfView.as_view(), name="athlete-program-pdf-send"),
    path("program-pdf/send-sms/", program_pdf.SendProgramSmsView.as_view(), name="program-pdf-send-sms"),
    path("shared-pdf/<str:token>/", program_pdf.SharedPdfView.as_view(), name="shared-pdf"),
    path("program-pdf/<str:token>/", program_pdf.SignedProgramPdfView.as_view(), name="program-pdf-link"),
    # athlete app
    path("me/athlete/", coaching.MyAthleteView.as_view(), name="me-athlete"),
    path("me/health/", coaching.MyHealthView.as_view(), name="me-health"),
    path("me/progress/", coaching.MyProgressView.as_view(), name="me-progress"),
    path("me/today/", training.TodayView.as_view(), name="me-today"),
    path("me/schedule/", training.ScheduleView.as_view(), name="me-schedule"),
    path("me/nutrition/", tracking.NutritionDayView.as_view(), name="me-nutrition"),
    path("me/water/", tracking.WaterView.as_view(), name="me-water"),
    path("me/program.pdf", program_pdf.MyProgramPdfView.as_view(), name="me-program-pdf"),
    path("me/program-link/", program_pdf.MyProgramLinkView.as_view(), name="me-program-link"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("api/", include(api)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("healthz", lambda r: JsonResponse({"ok": True})),
    path("django-admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
