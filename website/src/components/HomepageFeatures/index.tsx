import Link from '@docusaurus/Link'
import useBaseUrl from '@docusaurus/useBaseUrl'
import Heading from '@theme/Heading'
import ThemedImage from '@theme/ThemedImage'

import styles from './styles.module.css'

type FeatureItem = {
  img: string
  title: string
  description: string
  link: string
}

function Feature({ img, title, description, link }: FeatureItem) {
  return (
    <div className="col col--4">
      <div className="text--center">
        <ThemedImage
          className={styles.featureSvg}
          sources={{
            light: useBaseUrl(`/img/${img}-light.svg`),
            dark: useBaseUrl(`/img/${img}-dark.svg`),
          }}
        />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h2">{title}</Heading>
        <p>{description}</p>
        <Link
          className="button button--primary"
          to={link}
          data-umami-event="Home CTA"
          data-umami-event-cta={title}>
          Learn more
        </Link>
      </div>
    </div>
  )
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <Feature
            img="sync"
            title="Create the procedures you need"
            link="/docs/introduction/#procedure-types-for-any-case"
            description="Enkaku supports stateless event and request messages, as well as stateful streams and channels supporting the exchange of multiple messages"
          />
          <Feature
            img="safe"
            title="Authentication and validation"
            link="/docs/introduction/#validate-and-authenticate-as-needed"
            description="Using JSON Web Tokens (JWTs), Enkaku supports both signed and unsigned messages, as well as messages validation using JSON schemas"
          />
          <Feature
            img="online"
            title="Run anywhere JS goes"
            link="/docs/introduction/#run-your-clients-and-servers-anywhere-js-goes"
            description="Using Web Streams for communications allows Enkaku clients and servers to run in a variety of environments"
          />
        </div>
      </div>
    </section>
  )
}
