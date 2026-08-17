import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from './services/theme.service';
import { I18nService } from './services/i18n.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet]
})
export class AppComponent implements OnInit {
  constructor(
    private themeService: ThemeService,
    private i18n: I18nService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.themeService.init(),
      this.i18n.init()
    ]);
  }
}
