import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { UserService, HoursService, BillingService } from '../../services';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SplashPage implements OnInit {
  constructor(
    private router: Router,
    private userService: UserService,
    private hoursService: HoursService,
    private billingService: BillingService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    await Promise.all([
      this.userService.loadUser(),
      this.hoursService.loadHours(),
      this.billingService.loadValores(),
      this.billingService.loadSnapshots(),
      this.billingService.loadAdicionales(),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);

    const isOnboarded = await this.userService.isOnboarded();
    if (isOnboarded) {
      await this.router.navigate(['/calendar'], { replaceUrl: true });
    } else {
      await this.router.navigate(['/onboarding'], { replaceUrl: true });
    }
  }
}
