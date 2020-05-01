import {Manga} from '../models/Manga'
import {Chapter} from '../models/Chapter'
import {Source} from './Source'
import { SearchRequest } from '../models/SearchRequest'

export class MangaDex extends Source {
  private hMode: number
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
    this.hMode = 0
  }

  getHomePageSectionUrls() {
    return {
      "featured_new": {
        "request": {
          'url': 'https://mangadex.org'
        }, // REQUEST OBJECT HERE
        "sections": [
          {
            "id": "featured_titles",
            "title": "FEATURED TITLES",
            "items": [] // scraped items here
          },
          {
            "id": "new_titles",
            "title": "NEW TITLES",
            "items": [], // scraped items here
            "view_more": {} // request object here if this section supports "view all" button
          }
        ]
      },
      "recently_updated": {
        "request": {
          'url': 'https://mangadex.org/updates'
        }, // REQUEST OBJECT HERE
        "sections": [
          {
            "id": "recently_updated",
            "title": "RECENTLY UPDATED TITLES",
            "items": [],
            "view_more": {} // REQUEST OBJECT HERE
          }
        ]
      }
    }
  }
  
  getHomePageSections(key: any, data: any, sections: any) {
    let $ = this.cheerio.load(data)
    switch (key) {
      case "featured_new": sections = this.getFeaturedNew($, sections); break
      case "recently_updated": sections = this.getLatestUpdates($, sections); break
    }
    return sections
  }
  
  getFeaturedNew($: CheerioSelector, section: any) {
    let featuredManga: { id: number; title: string; image: string; bookmarks: number; rating: number }[] = []
    let newManga: { id: number; title: string; thumbUrl: string; chapterUpdates: any[] }[] = []
  
    $("#hled_titles_owl_carousel .large_logo").each(function (i: any, elem: any) {
      let title = $(elem)
  
      let img = title.find("img").first()
      let links = title.find("a")
  
      let idStr: any = links.first().attr("href")
      let id = idStr!!.match(/(\d+)(?=\/)/) ?? "-1"
  
      let caption = title.find(".car-caption p:nth-child(2)")
      let bookmarks = caption.find("span[title=Follows]").text()
      let rating = caption.find("span[title=Rating]").text()
      let item = {
        "id": parseInt(id),
        "title": img.attr("title") ?? " ",
        "image": img.attr("data-src") ?? " ",
        "bookmarks": parseInt(bookmarks),
        "rating": parseFloat(rating)
      }
      featuredManga.push(item)
    })
  
    $("#new_titles_owl_carousel .large_logo").each(function (i: any, elem: any) {
      let title = $(elem)
  
      let img = title.find("img").first()
      let links = title.find("a")
  
      let idStr: any = links.first().attr("href")
      let id = idStr.match(/(\d+)(?=\/)/) 
  
      var item = {
        "id": parseInt(id),
        "title": img.attr("title") ?? " ",
        "thumbUrl": img.attr("data-src") ?? " ",
        "chapterUpdates": []
      }
  
      let caption = title.find(".car-caption p:nth-child(2)")
      let obj: any = {  name: caption.find("a").text(), group: "", time: Date.parse(caption.find("span").attr("title") ?? " "), langCode: "" }
      item.chapterUpdates.push()
      newManga.push(item)
    })
    section[0].items = featuredManga
    section[1].items = newManga
    return section
  }
  
  getLatestUpdates($: CheerioSelector, section: any) {
    var updates: { chapterUpdates: { name: any; group: any; time: number; langCode: any }[] }[] = []
    $("tr").each(function (i: any, elem: any) {
      let row: any = $(elem)
      let imgs = row.find("img")
      let img = imgs.first()
      let links = row.find("a")
      if (imgs.length > 0) {
        let idStr = links.first().attr("href")
        let id = idStr.match(/(\d+)(?=\/)/)
  
        let item = {
          id: parseInt(id),
          title: $(links[1]).text(),
          thumbUrl: img.attr("src").replace(".thumb", ".large"),
          chapterUpdates: []
        }
        updates.push(item)
  
      } else if (links.length > 0) {
        let time = row.find("time")
        let chapterUpdate = {
          name: links.first().text().replace("Vol.", "V.").replace("Ch.", "C."),
          group: $(links[1]).text(),
          time: Date.parse(time.attr("datetime")),
          langCode: row.find(".flag").attr("class").replace(/(rounded.?)?(flag.)?/, "")
        }
  
        updates[updates.length - 1].chapterUpdates.push(chapterUpdate)
      }
    })
    section[2].items = updates
    return section
  }

  filterUpdatedMangaUrls(ids: any, time: Date) {
    return {
      'titles': {
        'metadata': {
          'initialIds': ids,
          'referenceTime': time
        },
        'request': {
          'url': 'https://mangadex.org/titles/0/',
          'config': {
            'headers' : {
              
            },
          },
          'incognito': true,
          'cookies':[
            { 
              'key': 'mangadex_title_mode',
              'value': 2
            },
            { 
              'key': 'mangadex_h_mode',
              'value': this.hMode
            }
          ]
        }
      }
    }
  }

  filterUpdatedManga(data: any, metadata: any) {
    let $ = this.cheerio.load(data.data)
    
    let returnObject: {'updatedMangaIds': string[], 'nextPage': boolean} = {
      'updatedMangaIds': [],
      'nextPage': true
    }

    for (let elem of $('.manga-entry').toArray()) {
      let id = elem.attribs['data-id']
      if (new Date($(elem).find('time').attr('datetime')?.toString() ?? "") > metadata.referenceTime) {
        if (metadata.initialIds.includes(id)) {
          returnObject.updatedMangaIds.push(id)
        }
      }
      else {
        returnObject.nextPage = false
        return returnObject
      }
    }

    return returnObject
  }

  getMangaDetailsRequest(ids: string[]): any {
    return {
      'manga': {
        'metadata': {
          'initialIds': ids
        },
        'request': {
          'url': 'https://mangadex.org/title/',
          'config': {
            'headers' : {
              
            },
          },
          'incognito':  true,
          'cookies': []
        }
      }
    }
  }

  // TODO: TO BE IMPLEMENTED
  getMangaDetails(data: any) {
    console.log(data)
  }

  getMangaDetailsBulk(data: any): Manga[] {
    let manga: Manga[] = []
    let unformatedManga = data.result
    for (let u of unformatedManga) {
      let formattedManga: Manga = Manga.fromJSON(u)
      manga.push(formattedManga)
    }
    return manga
  }

  getTagsUrl() {
    return {
      'url': 'url'
    }
  }

  // Tags are already formatted at the cache server level
  getTags(data: any) {
    return data.result
  }

  getChapterUrls(mangaId: string): any {
    return {
      'manga': {
        'metadata': {
          'id': mangaId
        },
        'request': {
          'url': 'https://mangadex.org/api/manga/',
          'config': {
            'headers' : {
              
            },
          },
          'incognito':  true,
          'cookies':[]
        }
      }
    }
  }

  getChapters(data: any, mangaId: string) {
    data = data.data.chapter
    let entries = Object.entries(data)
    let chapters: Chapter[] = []
    for (let entry of entries) {
      let id: string = entry[0]
      let info: any = entry[1]
      chapters.push(new Chapter(id, 
        mangaId, 
        info.title,
        info.chapter,
        info.volume, 
        info.group_name,
        0,
        new Date(info.timestamp),
        false,
        info.lang_code))
    }

    return chapters
  }

  getChapterDetailsUrls(mangaId: string, chapId: string) {
    throw new Error("Method not implemented.")
  }
  
  getChapterDetails(data: any, metadata: any) {
    throw new Error("Method not implemented.")
  }

  search(data: any): any {
    throw new Error("Method not implemented.")
  }

  advancedSearch(data: any) {
    throw new Error("Method not implemented.")
  }

  getSearchUrls(query: SearchRequest) {
    return {
      'metadata': {
        'q': query
      },
      'url': 'https://mangadex.org/search?'
    }
  }

  // manga are already formatted at the cache server level
  searchMangaCached(data: any): any {
    return data.result
  }

}