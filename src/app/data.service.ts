import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, Subject, takeUntil} from 'rxjs';

import {environment} from '../environments/environment';
import {ActivatedRoute, Router} from '@angular/router';
import moment from 'moment';
import {
    IMetaData, IQueryParam,
    ISummaryData, IWrappedCountryStatsData, IWrappedPlotData,
    IWrappedSummaryData, IWrappedTopicCountryData,
    IWrappedTopicData,
    IWrappedTopicPlotData
} from "./dashboard/types";

export const propertyOrderForCSV: string[] = [
    "changesets",
    "users",
    "roads",
    "buildings",
    "edits",
    "healthcare",
    "waterway",
    "latest",
    "country",
    "hashtag",
];

@Injectable()
export class DataService {

    url = environment.ohsomeStatsServiceUrl
    private bsMetaData = new BehaviorSubject<IMetaData | null>(null)
    private metadata = this.bsMetaData.asObservable()
    private bsSummaryData = new BehaviorSubject<ISummaryData | null>(null)
    summaryData = this.bsSummaryData.asObservable()
    abortHashtagReqSub!: Subject<void>
    abortTopicReqSub!: Subject<void>
    abortSummaryReqSub!: Subject<void>
    abortIntervalReqSub!: Subject<void>

    defaultHashtag = 'missingmaps'
    trendingHashtagLimit = 10
    timeIntervals = [
        {label: 'hourly', value: 'PT1H'},
        {label: 'daily', value: 'P1D'},
        {label: 'weekly', value: 'P1W'},
        {label: 'monthly', value: 'P1M'},
        {label: 'quarterly', value: 'P3M'},
        {label: 'yearly', value: 'P1Y'},
    ]
    defaultIntervalValue = 'P1M'
    minDate!: string
    maxDate!: string

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        private router: Router) {
        this.getAbortHashtagReqSubject()
        this.getAbortSummaryReqSubject()
        this.getAbortTopicReqSubject()
        this.getAbortIntervalReqSubject()
    }

    // will be called by APP_INITIALIZER provider in app.module.ts on the start of the application
    requestMetadata() {
        return this.http.get(`${this.url}/metadata`).subscribe((meta: any) => {
            // console.log('>>> DataService >>> meta = ', meta)
            this.setDefaultTime(meta.result.min_timestamp, meta.result.max_timestamp)
            const tempStart = new Date(meta.result.max_timestamp)
            tempStart.setDate(tempStart.getDate() - 365)
            // if URL params are empty then fill it with default values
            const queryParams = this.getQueryParamsFromFragments(this.route.snapshot.fragment);

            this.updateURL({
                hashtags: queryParams && queryParams.hashtags ? queryParams.hashtags : this.defaultHashtag,
                interval: queryParams && queryParams.interval ? queryParams.interval : this.defaultIntervalValue,
                start: queryParams && queryParams.start ? queryParams.start : queryParams && queryParams.hashtags ? meta.result.min_timestamp : tempStart.toISOString(),
                end: queryParams && queryParams.end ? queryParams.end : this.maxDate,
                countries: queryParams && queryParams.countries ? queryParams.countries : '',
                topics: queryParams && queryParams.topics ? queryParams.topics : ''
            })
        })
    }

    requestAllHashtags(){
        return this.http.get(`${this.url}/hashtags`)
    }

    /**
     * Creates query param from enitre fragment of the URL
     *
     * @param fragment URL fragment part
     * @returns Object with all query params sepearted
     */
    getQueryParamsFromFragments(fragment: string | null): any {
        if (fragment == null || fragment.length < 2)
            return null

        const tempQueryParams: Array<Array<string>> = fragment?.split('&')
            .map(q => [q.split('=')[0], q.split('=')[1]])
        return Object.fromEntries(tempQueryParams)
    }

    getMetaData(): Observable<IMetaData | null> {
        return this.metadata
    }

    requestSummary(params: any): Observable<IWrappedSummaryData> {
        return this.http.get<IWrappedSummaryData>(`${this.url}/stats/${params['hashtags']}?startdate=${params['start']}&enddate=${params['end']}&countries=${params['countries']}`)
            .pipe(
                takeUntil(this.abortSummaryReqSub)
            )
    }

    requestTopic(params: any): Observable<IWrappedTopicData> {
        return this.http.get<IWrappedTopicData>(`${this.url}/topic/${params['topics']}?hashtag=${params['hashtags']}&startdate=${params['start']}&enddate=${params['end']}&countries=${params['countries']}`)
            .pipe(
                takeUntil(this.abortTopicReqSub)
            )
    }

    requestTopicInterval(params: any): Observable<IWrappedTopicPlotData> {
        return this.http.get<IWrappedTopicPlotData>(`${this.url}/topic/${params['topics']}/interval?hashtag=${params['hashtags']}&startdate=${params['start']}&enddate=${params['end']}&countries=${params['countries']}&interval=${params['interval']}`)
            .pipe(
                takeUntil(this.abortTopicReqSub)
            )
    }

    requestTopicCountryStats(params: any): Observable<IWrappedTopicCountryData> {
        return this.http.get<IWrappedTopicCountryData>(`${this.url}/topic/${params['topics']}/country?hashtag=${params['hashtags']}&startdate=${params['start']}&enddate=${params['end']}`)
            .pipe(
                takeUntil(this.abortIntervalReqSub)
            )
    }

    requestPlot(params: any): Observable<IWrappedPlotData> {
        return this.http.get<IWrappedPlotData>(`${this.url}/stats/${params['hashtags']}/interval?startdate=${params['start']}&enddate=${params['end']}&interval=${params['interval']}&countries=${params['countries']}`)
            .pipe(
                takeUntil(this.abortIntervalReqSub)
            )
    }

    requestCountryStats(params: any): Observable<IWrappedCountryStatsData> {
        return this.http.get<IWrappedCountryStatsData>(`${this.url}/stats/${params['hashtags']}/country?startdate=${params['start']}&enddate=${params['end']}`)
            .pipe(
                takeUntil(this.abortIntervalReqSub)
            )
    }

    getSummary() {
        // return this.bsSummaryData.getValue()
        return this.summaryData
    }

    setSummary(data: ISummaryData) {
        this.bsSummaryData.next(data)
    }

    getAbortHashtagReqSubject() {
        this.abortHashtagReqSub = new Subject<void>();
    }

    getAbortSummaryReqSubject() {
        this.abortSummaryReqSub = new Subject<void>();
    }

    getAbortIntervalReqSubject() {
        this.abortIntervalReqSub = new Subject<void>();
    }

    getAbortTopicReqSubject() {
        this.abortTopicReqSub = new Subject<void>();
    }

    getTrendingHashtags(params: any) {
        // console.log('>>> getTrendingHashtags >>> ', params)
        return this.http.get(`${this.url}/most-used-hashtags?startdate=${params['start']}&enddate=${params['end']}&limit=${params['limit']}`)
            .pipe(
                takeUntil(this.abortHashtagReqSub)
            )
    }

    /**
     * Gives the default values for application
     *
     * @returns IQueryParam
     */
    getDefaultValues(): IQueryParam | null {
        if (!(this.minDate && this.maxDate))
            return null

        const tempStart = moment(this.maxDate).subtract(1, 'year').startOf('day')

        return {
            start: tempStart.toISOString(),
            end: this.maxDate,
            hashtags: this.defaultHashtag,
            interval: this.defaultIntervalValue,
            countries: '',
            topics: ''
        }
    }

    setDefaultTime(minTimestamp: string, maxTimestamp: string) {
        this.maxDate = new Date(maxTimestamp).toISOString()
        this.minDate = new Date(minTimestamp).toISOString()

        this.bsMetaData.next({
            start: this.minDate,
            end: this.maxDate
        })
    }

    updateURL(data: IQueryParam): void {
        this.router.navigate([], {
            fragment: `hashtags=${data.hashtags}&start=${data.start}&end=${data.end}&interval=${data.interval}&countries=${data.countries}&topics=${data.topics}`
        })
    }
}
