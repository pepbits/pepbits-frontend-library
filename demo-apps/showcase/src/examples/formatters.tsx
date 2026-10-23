"use client";
import React from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {createFormatters,directionOf} from '@pepbits/i18n';
import {formatOptionsFrom} from '@pepbits/preferences';
import {usePreferences} from '@pepbits/preferences/react';
import {DescriptionList} from '@pepbits/components';
export function FormattersDemo(){const {preferences}=usePreferences(),{t}=useLocalization(),format=createFormatters(formatOptionsFrom(preferences));return <DescriptionList items={[{id:'language',label:'Language',value:`${preferences.language} / ${directionOf(preferences.language)}`},{id:'translation',label:'Translation',value:t('save')},{id:'date',label:'Date',value:format.date('2026-10-23')},{id:'time',label:'Time',value:format.time('14:30')},{id:'number',label:'Number',value:format.number(12345.67)},{id:'money',label:'Money',value:format.money(12345.67)},{id:'datetime',label:'Date and time',value:format.dateTime('2026-10-23T14:30:00Z')}]} />;}
