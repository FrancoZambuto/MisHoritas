import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { IonicStorageModule } from '@ionic/storage-angular';

import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

const routes = [
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full' as const
  },
  {
    path: 'splash',
    loadComponent: () => import('./app/pages/splash/splash.page').then(m => m.SplashPage)
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./app/pages/onboarding/onboarding.page').then(m => m.OnboardingPage)
  },
  {
    path: 'calendar',
    loadComponent: () => import('./app/pages/calendar/calendar.page').then(m => m.CalendarPage)
  },
  {
    path: 'billing',
    loadComponent: () => import('./app/pages/billing/billing.page').then(m => m.BillingPage)
  },
  {
    path: 'reports',
    loadComponent: () => import('./app/pages/reports/reports.page').then(m => m.ReportsPage)
  }
];

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({
      mode: 'ios',
      animated: true
    }),
    provideRouter(routes),
    importProvidersFrom(
      IonicStorageModule.forRoot({
        name: '__horitasbioq_db',
        driverOrder: ['indexeddb', 'localstorage']
      })
    )
  ]
});
