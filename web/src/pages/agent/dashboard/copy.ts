/**
 * AGT-DSH-002 Pro dashboard copy — EN + AR.
 * LOGIN_COPY shape (per-key `{ en, ar }`) matching `components/auth/loginCopy.ts`.
 * Arabic tone: real MENA product Arabic (same register as loginCopy).
 */

export type DashboardLocale = 'en' | 'ar'

export const LOGIN_COPY = {
  'common.loading': {
    en: 'Loading',
    ar: 'جارٍ التحميل',
  },
  'greeting.morning': {
    en: 'Good morning',
    ar: 'صباح الخير',
  },
  'greeting.afternoon': {
    en: 'Good afternoon',
    ar: 'مساء الخير',
  },
  'greeting.evening': {
    en: 'Good evening',
    ar: 'مساء الخير',
  },
  'greeting.nameFallback': {
    en: 'there',
    ar: 'هناك',
  },
  'tenant.agency': {
    en: 'Agency',
    ar: 'وكالة',
  },
  'tenant.personal': {
    en: 'Personal',
    ar: 'شخصي',
  },
  'action.newListing': {
    en: 'New listing',
    ar: 'إعلان جديد',
  },
  'action.contact': {
    en: 'Contact',
    ar: 'جهة اتصال',
  },
  'action.task': {
    en: 'Task',
    ar: 'مهمة',
  },
  'action.publish': {
    en: 'Publish',
    ar: 'نشر',
  },
  'action.inbox': {
    en: 'Inbox',
    ar: 'الوارد',
  },
  'action.search': {
    en: 'Search',
    ar: 'بحث',
  },
  'action.addWidget': {
    en: 'Add widget',
    ar: 'إضافة ودجة',
  },
  'action.addWidgetPlus': {
    en: 'Add widget +',
    ar: 'إضافة ودجة +',
  },
  'action.resetLayout': {
    en: 'Reset layout',
    ar: 'إعادة تعيين التخطيط',
  },
  'action.openInbox': {
    en: 'Open inbox',
    ar: 'فتح الوارد',
  },
  'action.openTasks': {
    en: 'Open tasks',
    ar: 'فتح المهام',
  },
  'confirm.resetLayout': {
    en: 'Reset dashboard to default layout? Your current arrangement will be lost.',
    ar: 'إعادة تعيين لوحة التحكم إلى التخطيط الافتراضي؟ سيُفقد ترتيبك الحالي.',
  },
  'empty.noWidgets': {
    en: 'No widgets yet. Press `Add widget +` or use `/` to search.',
    ar: 'لا توجد ودجات بعد. اضغط «إضافة ودجة +» أو استخدم `/` للبحث.',
  },
  'save.saving': {
    en: 'Saving…',
    ar: 'جارٍ الحفظ…',
  },
  'save.saved': {
    en: 'Saved',
    ar: 'تم الحفظ',
  },
  'density.aria': {
    en: 'Dashboard density',
    ar: 'كثافة لوحة التحكم',
  },
  'density.compact': {
    en: 'compact',
    ar: 'مضغوط',
  },
  'density.comfortable': {
    en: 'comfortable',
    ar: 'مريح',
  },
  'density.spacious': {
    en: 'spacious',
    ar: 'واسع',
  },
  'aria.drag': {
    en: 'Drag {title}',
    ar: 'سحب {title}',
  },
  'aria.dragTitle': {
    en: 'Drag to rearrange',
    ar: 'اسحب لإعادة الترتيب',
  },
  'aria.fullscreen': {
    en: 'Fullscreen {title}',
    ar: 'ملء الشاشة {title}',
  },
  'aria.remove': {
    en: 'Remove {title}',
    ar: 'إزالة {title}',
  },
  'aria.removeSr': {
    en: 'Remove',
    ar: 'إزالة',
  },
  'aria.widgetGrid': {
    en: 'Pro dashboard widgets',
    ar: 'ودجات لوحة Pro',
  },
  'shortcuts.title': {
    en: 'Keyboard shortcuts',
    ar: 'اختصارات لوحة المفاتيح',
  },
  'shortcuts.reopen': {
    en: 'Press `?` any time to reopen',
    ar: 'اضغط `؟` في أي وقت لإعادة الفتح',
  },
  'shortcut.openShortcuts': {
    en: 'Open shortcuts',
    ar: 'فتح الاختصارات',
  },
  'shortcut.commandPalette': {
    en: 'Command palette',
    ar: 'لوحة الأوامر',
  },
  'shortcut.focusSearch': {
    en: 'Focus search',
    ar: 'التركيز على البحث',
  },
  'shortcut.goDashboard': {
    en: 'Go to Dashboard',
    ar: 'الانتقال إلى لوحة التحكم',
  },
  'shortcut.goInbox': {
    en: 'Go to Inbox',
    ar: 'الانتقال إلى الوارد',
  },
  'shortcut.goListings': {
    en: 'Go to Listings',
    ar: 'الانتقال إلى الإعلانات',
  },
  'shortcut.fullscreenWidget': {
    en: 'Fullscreen widget N',
    ar: 'ملء الشاشة للودجة N',
  },
  'shortcut.toggleEdit': {
    en: 'Toggle edit mode',
    ar: 'تبديل وضع التحرير',
  },
  'shortcut.exitFullscreen': {
    en: 'Exit fullscreen / edit',
    ar: 'الخروج من ملء الشاشة / التحرير',
  },
  'widget.title.kpiActive': {
    en: 'Active listings',
    ar: 'الإعلانات النشطة',
  },
  'widget.title.kpiViews': {
    en: 'Views',
    ar: 'المشاهدات',
  },
  'widget.title.kpiInquiries': {
    en: 'Inquiries',
    ar: 'الاستفسارات',
  },
  'widget.title.kpiPipeline': {
    en: 'Pipeline value',
    ar: 'قيمة المسار',
  },
  'widget.title.kpiBazaar': {
    en: 'Bazaar-driven leads',
    ar: 'عملاء من بازار',
  },
  'widget.title.urgent': {
    en: 'Urgent',
    ar: 'عاجل',
  },
  'widget.title.quota': {
    en: 'Quota / credits',
    ar: 'الحصة / الأرصدة',
  },
  'widget.title.recentListings': {
    en: 'Recent listings',
    ar: 'أحدث الإعلانات',
  },
  'widget.title.inboxPreview': {
    en: 'Inbox preview',
    ar: 'معاينة الوارد',
  },
  'widget.title.tasks': {
    en: "Today's tasks",
    ar: 'مهام اليوم',
  },
  'widget.title.funnel': {
    en: 'Funnel',
    ar: 'القمع',
  },
  'widget.title.activity': {
    en: 'Recent activity',
    ar: 'النشاط الأخير',
  },
  'widget.title.calendar': {
    en: 'Calendar (next 7 days)',
    ar: 'التقويم (٧ أيام القادمة)',
  },
  'kpi.activeListings': {
    en: 'Active listings',
    ar: 'الإعلانات النشطة',
  },
  'kpi.viewsMtd': {
    en: 'Views (MTD)',
    ar: 'المشاهدات (هذا الشهر)',
  },
  'kpi.inquiries': {
    en: 'Inquiries',
    ar: 'الاستفسارات',
  },
  'kpi.pipelineValue': {
    en: 'Pipeline value',
    ar: 'قيمة المسار',
  },
  'kpi.bazaarLeads': {
    en: 'Bazaar-driven leads',
    ar: 'عملاء من بازار',
  },
  'kpi.delta.liveCount': {
    en: 'Live count',
    ar: 'العدد الحالي',
  },
  'kpi.delta.fromStats': {
    en: 'From dashboard stats',
    ar: 'من إحصاءات اللوحة',
  },
  'kpi.delta.openPipeline': {
    en: 'Open pipeline',
    ar: 'المسار المفتوح',
  },
  'kpi.delta.openCount': {
    en: '{count} open',
    ar: '{count} مفتوحة',
  },
  'kpi.delta.syndicated': {
    en: '{count} syndicated listings',
    ar: '{count} إعلانات مُوزَّعة',
  },
  'urgent.empty': {
    en: 'No urgent items right now.',
    ar: 'لا توجد عناصر عاجلة الآن.',
  },
  'urgent.slaBreachedOne': {
    en: '{count} SLA-breached inquiry',
    ar: 'استفسار واحد متجاوز لاتفاقية الخدمة',
  },
  'urgent.slaBreachedMany': {
    en: '{count} SLA-breached inquiries',
    ar: '{count} استفسارات متجاوزة لاتفاقية الخدمة',
  },
  'urgent.overdueTask': {
    en: 'Overdue task',
    ar: 'مهمة متأخرة',
  },
  'urgent.viewing': {
    en: 'Viewing',
    ar: 'معاينة',
  },
  'urgent.inquiry': {
    en: 'Inquiry',
    ar: 'استفسار',
  },
  'status.urgent': {
    en: 'urgent',
    ar: 'عاجل',
  },
  'status.overdue': {
    en: 'overdue',
    ar: 'متأخر',
  },
  'status.today': {
    en: 'today',
    ar: 'اليوم',
  },
  'status.new': {
    en: 'new',
    ar: 'جديد',
  },
  'quota.load': {
    en: "Today's operational load",
    ar: 'العبء التشغيلي اليوم',
  },
  'quota.dueToday': {
    en: 'Due today',
    ar: 'مستحق اليوم',
  },
  'quota.overdue': {
    en: 'Overdue',
    ar: 'متأخر',
  },
  'quota.viewings': {
    en: 'Viewings',
    ar: 'المعاينات',
  },
  'listings.empty': {
    en: 'No listings yet.',
    ar: 'لا توجد إعلانات بعد.',
  },
  'listings.fallbackTitle': {
    en: 'Listing',
    ar: 'إعلان',
  },
  'inbox.empty': {
    en: 'No unread threads.',
    ar: 'لا توجد محادثات غير مقروءة.',
  },
  'inbox.threadFallback': {
    en: 'Thread',
    ar: 'محادثة',
  },
  'inbox.badgeFallback': {
    en: 'inbox',
    ar: 'وارد',
  },
  'tasks.empty': {
    en: 'No tasks for today.',
    ar: 'لا مهام لليوم.',
  },
  'tasks.fallbackTitle': {
    en: 'Task',
    ar: 'مهمة',
  },
  'funnel.leads': {
    en: 'Leads',
    ar: 'العملاء المحتملون',
  },
  'funnel.viewings': {
    en: 'Viewings',
    ar: 'المعاينات',
  },
  'funnel.offers': {
    en: 'Offers',
    ar: 'العروض',
  },
  'funnel.closed': {
    en: 'Closed',
    ar: 'مُغلق',
  },
  'activity.inquiryRow': {
    en: 'Inquiry · {name}',
    ar: 'استفسار · {name}',
  },
  'activity.empty': {
    en: 'Activity feed empty.',
    ar: 'سجل النشاط فارغ.',
  },
  'calendar.viewingFallback': {
    en: 'Viewing',
    ar: 'معاينة',
  },
  'calendar.empty': {
    en: 'No upcoming viewings.',
    ar: 'لا معاينات قادمة.',
  },
  'widget.unavailable': {
    en: 'Widget unavailable.',
    ar: 'الودجة غير متاحة.',
  },
} as const

export type DashboardCopyKey = keyof typeof LOGIN_COPY

export function t(
  key: DashboardCopyKey,
  locale: DashboardLocale,
  vars?: Record<string, string | number>,
): string {
  let value: string = LOGIN_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}

/** Widget grid title keys keyed by layout widget id. */
export const WIDGET_TITLE_KEYS: Record<string, DashboardCopyKey> = {
  'kpi-active': 'widget.title.kpiActive',
  'kpi-views': 'widget.title.kpiViews',
  'kpi-inquiries': 'widget.title.kpiInquiries',
  'kpi-pipeline': 'widget.title.kpiPipeline',
  'kpi-bazaar': 'widget.title.kpiBazaar',
  urgent: 'widget.title.urgent',
  quota: 'widget.title.quota',
  'recent-listings': 'widget.title.recentListings',
  'inbox-preview': 'widget.title.inboxPreview',
  tasks: 'widget.title.tasks',
  funnel: 'widget.title.funnel',
  activity: 'widget.title.activity',
  calendar: 'widget.title.calendar',
}
