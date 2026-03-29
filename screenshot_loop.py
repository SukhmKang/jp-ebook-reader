# /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

import asyncio
import random
import sys
import os
from playwright.async_api import async_playwright

async def screenshot_loop(target_url, output_dir="screenshots", num_screenshots=10, delay_min=0.5, delay_max=2.5, screenshot_delay=1.5):
    os.makedirs(output_dir, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        context = browser.contexts[0]
        
        page = next((pg for pg in context.pages if target_url in pg.url), None)
        
        if not page:
            print(f"No tab found matching '{target_url}'")
            print("Open tabs:")
            for tab in context.pages:
                print(f"  {tab.url}")
            return
        
        print(f"Connected to: {page.url}")
        
        for i in range(num_screenshots):
            path = f"{output_dir}/screenshot_{i:03d}.png"
            await page.screenshot(path=path)
            
            delay = random.uniform(delay_min, delay_max)
            print(f"[{i+1}/{num_screenshots}] Saved {path} — waiting {delay:.2f}s")
            
            await page.keyboard.press("ArrowLeft")
            await asyncio.sleep(screenshot_delay)  # wait for page to load
            await asyncio.sleep(delay)              # random delay before next screenshot
        
        print("Done!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python screenshot_loop.py <url_fragment> [num_screenshots] [output_dir]")
        sys.exit(1)
    
    target_url = sys.argv[1]
    num = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    output_dir = sys.argv[3] if len(sys.argv) > 3 else "screenshots"
    
    asyncio.run(screenshot_loop(target_url, output_dir=output_dir, num_screenshots=num, screenshot_delay=1))