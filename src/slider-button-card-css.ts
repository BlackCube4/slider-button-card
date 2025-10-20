import { css } from 'lit-element';

export const sliderButtonCardStyles = css`
overflow_fix {
  overflow: hidden; /* needed or else the slider will trigger scroll bar when it leaves hui-view even though it's invisible */
}
ha-card {
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  touch-action: pan-y;
  line-height: 0;
}
  
:host {
  --slider-bg-default-color: var(--primary-color, rgb(95, 124, 171));
  --slider-bg: var(--slider-color);
  --slider-bg-filter: brightness(100%);
  --slider-bg-direction: to right;
  --slider-value: 0%;
  --slider-transition-duration: 1s;      
  --icon-filter: brightness(100%);
  --icon-color: var(--paper-item-icon-color);
  --btn-bg-color-off: rgba(43,55,78,1);
  --btn-bg-color-on: #20293c;
}

/* --- BUTTON --- */

.button {
  position: relative;
  padding: 0.8rem;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  display: block;
  border-radius: calc(var(--ha-card-border-radius, 12px) - var(--ha-card-border-width, 1px));
  mask-image: radial-gradient(white, black);
  transition: all 0.2s ease-in-out;
  touch-action: pan-y;
}
.slider[data-mode="top-bottom"],
.slider[data-mode="bottom-top"] {
  touch-action: none;
}
ha-card.compact .button {
  padding: 10px;
}

/* --- ICON --- */

.icon {
  position: relative;
  cursor: pointer;
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  padding: 0;
  outline: none;
  animation: var(--icon-rotate-speed, 0s) linear 0s infinite normal both running rotate;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--ha-card-background, var(--card-background-color, #fff));
  -webkit-tap-highlight-color: transparent;
}
.icon icon-background {
  background-color: var(--icon-bg-color);
  width: 100%;
  height: 100%;
  position: absolute;
  transition: background-color var(--slider-transition-duration);
}
.icon ha-icon {
  filter: var(--icon-filter, brightness(100%));
  color: var(--icon-color);
  transition: color var(--slider-transition-duration), filter var(--slider-transition-duration);
}
.icon.has-picture {
  background-size: cover;
  border-radius: 50%;
}
.icon.has-picture ha-icon{
  display: none;
}
.icon.no-action{
  pointer-events: none;
}
.unavailable .icon ha-icon {
  color: var(--disabled-text-color);
}
.compact .icon {
  float: left;
}

/* --- TEXT --- */

.text {
  position: relative;
  padding-top: inherit;
  pointer-events: none;
  user-select: none;
  font-size: 1.1rem;
  line-height: 1.3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  white-space: nowrap;
  text-shadow: var(--state-text-shadow);
}
.compact .text {
  height: 36px;
  left: 0.5rem;
  padding: 0;
}

/* --- LABEL --- */

.name {
  color: var(--label-color-on, var(--primary-text-color, white));
  text-shadow: var(--label-text-shadow, none);
  overflow: hidden;
  text-overflow: ellipsis;
}
.off .name {
  color: var(--label-color-off, var(--primary-text-color, white));
}
.unavailable.off .name,
.unavailable .name {
  color: var(--disabled-text-color);
}
.compact .name {
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: .1px;
  color: var(--primary-text-color);
}

/* --- STATE --- */

.state {
  transition: font-size 0.1s ease-in-out;
  overflow: hidden;
  text-overflow: ellipsis;
}
.changing .state {
  font-size: 15px;
}
.off .state {
  color: var(--state-color-off, var(--disabled-text-color));
}
.unavailable .state {
  color: var(--disabled-text-color);
}
.oneliner {      
  /* color: var(--state-color-on, var(--label-badge-text-color, white)); */
  color: var(--primary-text-color);
  font-weight: 400;
  font-size: 12px;
  line-height: 16px;
  height: 16px;
  letter-spacing: .4px;
  display: block;
  overflow: hidden;
}

/* --- SLIDER --- */    

.slider {
  position: absolute;      
  top: 0px;
  left: 0px;
  height: 100%;
  width: 100%;
  background-color: var( --ha-card-background, var(--card-background-color, var(--btn-bg-color-on, black)) );
  cursor: pointer;
  /* cursor: ew-resize; */
  z-index: 0;
}

/* 
.slider[data-mode="bottom-top"],
.slider[data-mode="top-bottom"] {
  cursor: ns-resize;
}
*/

/* --- SLIDER OVERLAY (for disable_sliding = true) --- */      
  
.slider .toggle-overlay {
  position: absolute;      
  top: 0px;
  left: 0px;
  height: 100%;
  width: 100%;
  opacity: 0;
  z-index: 999;    
}

/* --- SLIDER BACKGROUND --- */   
 
.slider-bg {       
  position: absolute;
  top: 0;
  left: 0px;
  height: 100%;
  width: 100%;
  background: var(--slider-bg);
  background-size: var(--slider-bg-size, 100% 100%);
  background-color: var(--slider-bg-color, transparent);
  background-position: var(--slider-bg-position, 0 0);
  filter: var(--slider-bg-filter, brightness(100%));
  transition: background-color var(--slider-transition-duration);
}
.slider[data-background="solid"] .slider-bg {            
  --slider-bg-color: var(--slider-color);
}
.slider[data-background="triangle"] .slider-bg {      
  --slider-bg-direction: to bottom right;    
  --slider-bg: linear-gradient(var(--slider-bg-direction), transparent 0%, transparent 50%, var(--slider-color) 50%, var(--slider-color) 100%);
  border-right: 0px solid;
}    
.slider[data-background="triangle"][data-mode="right-left"] .slider-bg {
  --slider-bg-direction: to bottom left;
}
.slider[data-background="triangle"][data-mode="bottom-top"] .slider-bg {
  --slider-bg-direction: to top left;      
}    
.slider[data-background="triangle"][data-mode="top-bottom"] .slider-bg {
  --slider-bg-direction: to bottom left;      
}
.slider[data-background="custom"] .slider-bg {    
  --slider-bg: repeating-linear-gradient(-45deg, var(--slider-color) 0, var(--slider-color) 1px, var(--slider-color) 0, transparent 10%);
  --slider-bg-size: 30px 30px;
}    
.slider[data-background="gradient"] .slider-bg {
  --slider-bg: linear-gradient(var(--slider-bg-direction), rgba(0, 0, 0, 0) -10%, var(--slider-color) 100%);
}    
.slider[data-background="striped"] .slider-bg {
  --slider-bg: linear-gradient(var(--slider-bg-direction), var(--slider-color), var(--slider-color) 50%, transparent 50%, transparent);
  --slider-bg-size: 4px 100%;
}
.slider[data-background="striped"][data-mode="bottom-top"] .slider-bg,
.slider[data-background="striped"][data-mode="top-bottom"] .slider-bg {      
  --slider-bg-size: 100% 4px;
}    
.slider[data-mode="right-left"] .slider-bg {
  --slider-bg-direction: to left;      
}    
.slider[data-mode="bottom-top"] .slider-bg {
  --slider-bg-direction: to top;      
}    
.slider[data-mode="top-bottom"] .slider-bg {
  --slider-bg-direction: to bottom;      
}

/* --- SLIDER THUMB --- */

.slider-thumb {
  position: relative;
  width: 100.5%;  /* + 0.5 firefox... */
  height: 100.5%;      
  transform: translateX(var(--slider-value));
  background: transparent;
  transition: transform var(--slider-transition-duration);
}
.changing .slider .slider-thumb {
  transition: none;
}    
.slider[data-mode="right-left"] .slider-thumb {
  transform: translateX(calc(var(--slider-value) * -1))  !important;
}
.slider[data-mode="top-bottom"] .slider-thumb {
  transform: translateY(var(--slider-value)) !important;
}
.slider[data-mode="bottom-top"] .slider-thumb {
  transform: translateY(calc(var(--slider-value) * -1))  !important;
}

.slider-thumb:before {
  content: '';
  position: absolute;
  top: 0;
  left: -2px;
  height: 100%;
  width: 2px;          
  background: var(--slider-color);
  opacity: 0;       
  transition: opacity 0.2s ease-in-out 0s;   
  box-shadow: var(--slider-color) 0px 1px 5px 1px;
  z-index: 999;
}
.slider[data-mode="top-bottom"] .slider-thumb:before {
  top: -2px;
  left: 0px;
  height: 2px;
  width: 100%;              
}
.slider[data-mode="right-left"] .slider-thumb:before {
  left: auto;
  right: -2px;
}
.slider[data-mode="bottom-top"] .slider-thumb:before {
  top: auto;
  bottom: -2px;
  left: 0px;
  height: 2px;
  width: 100%;
}

.changing .slider-thumb:before {
  opacity: 0.5;    
}
.off.changing .slider-thumb:before {
  opacity: 0;    
}

.slider-thumb:after {
  content: '';
  position: absolute;
  top: 0;
  left: 0px;
  height: 100%;
  width: 100%;          
  background: var( --ha-card-background, var(--card-background-color, var(--btn-bg-color-on, black)) );
  opacity: 1;            
}
.slider[data-show-track="true"] .slider-thumb:after {
  opacity: 0.9;
}
.off .slider[data-show-track="true"] .slider-thumb:after {
  opacity: 1;
}

/* --- ACTION BUTTON --- */      
          
.action {
  position: relative;
  float: right;
  width: 36px;
  height: 36px;
  /* color: var(--action-icon-color-on, var(--paper-item-icon-color, black)); */
  cursor: pointer;
  outline: none;
  display: flex;
  justify-content: center;
  align-items: center;
  -webkit-tap-highlight-color: transparent;
  --mdc-icon-size: 26px;
}    
.action ha-switch {
}    
.off .action {
  color: var(--action-icon-color-off, var(--paper-item-icon-color, black));
}
.unavailable .action {
  color: var(--disabled-text-color);
}

/* --- MISC --- */

.mobile-vertical-scroll-helper {
  position: absolute;
  top: 0;
  left: 0;
  width: 56px;
  height: 100%;
}
@media (hover: hover) {
  .mobile-vertical-scroll-helper {
    pointer-events: none;
  }
}
`;