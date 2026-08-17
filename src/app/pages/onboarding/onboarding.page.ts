import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonButton, 
  ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  timeOutline, 
  calendarOutline, 
  businessOutline, 
  calculatorOutline,
  arrowForwardOutline 
} from 'ionicons/icons';
import { WizardComponent } from '../../components';
import { TranslatePipe } from '../../services/i18n.service';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonButton, TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OnboardingPage {
  constructor(
    private modalController: ModalController,
    private router: Router
  ) {
    addIcons({ 
      timeOutline, 
      calendarOutline, 
      businessOutline, 
      calculatorOutline,
      arrowForwardOutline 
    });
  }

  async openWizard(): Promise<void> {
    const modal = await this.modalController.create({
      component: WizardComponent,
      cssClass: 'wizard-modal',
      backdropDismiss: false
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    
    if (data?.completed) {
      await this.router.navigate(['/calendar'], { replaceUrl: true });
    }
  }
}
