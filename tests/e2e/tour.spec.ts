import {test,expect} from '@playwright/test';
test('tour navigates and opens sections',async({page})=>{
 await page.goto('/login'); await page.getByLabel('Email',{exact:true}).fill('staff@example.invalid'); await page.getByLabel('Password',{exact:true}).fill('testpassword'); await page.getByRole('button',{name:'Continue',exact:true}).click(); await page.goto('/admin');
 await page.getByRole('button',{name:'Start guided tour'}).click();
 const tour=page.getByRole('region',{name:'Guided platform tour'});
 await expect(tour).toContainText('Welcome to Creative Collective');
 await tour.getByRole('button',{name:'Next',exact:true}).click(); await expect(page).toHaveURL(/\/spaces/); await expect(tour).toContainText('Discover a space');
 await tour.getByRole('button',{name:'Next',exact:true}).click(); await expect(page).toHaveURL(/meeting-room/);
 await tour.getByRole('button',{name:'Next',exact:true}).click(); await expect(page).toHaveURL(/\/admin/);
 for(let i=0;i<5;i++) await tour.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.locator('[data-tour=create]')).toHaveAttribute('open','');
 await tour.getByRole('button',{name:'Next',exact:true}).click(); await expect(page.locator('[data-tour=insights]')).toHaveAttribute('open','');
 await tour.getByRole('button',{name:'Next',exact:true}).click(); await expect(page.locator('[data-tour=settings]')).toHaveAttribute('open','');
 await page.screenshot({path:'.cache/interactive-tour.png'});
 await tour.getByRole('button',{name:'Exit tour'}).click(); await expect(tour).toHaveCount(0);
});
